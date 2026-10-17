-- Make final-bill preparation retries idempotent.
-- Once a bill snapshot exists, a repeated call must not silently recalculate
-- lodging days, current rates, doctor fee, or discounts before payment.
CREATE OR REPLACE FUNCTION public.cashier_prepare_final_bill(p_encounter_id uuid, p_use_philhealth boolean DEFAULT false)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 v_actor uuid:=auth.uid(); v_role public.staff_role; v_active boolean;
 v_enc public.encounters%rowtype; v_patient public.patients%rowtype; v_bed public.beds%rowtype;
 v_ward public.wards%rowtype; v_doctor public.doctors%rowtype; v_existing public.bills%rowtype;
 v_days integer; v_lodging numeric(12,2); v_doctor_fee numeric(12,2); v_subtotal numeric(12,2);
 v_philhealth numeric(12,2):=0; v_pwd numeric(12,2):=0; v_total numeric(12,2); v_bill uuid; v_has_existing boolean:=false;
begin
 select sp.role,sp.is_active into v_role,v_active from public.staff_profiles sp where sp.user_id=v_actor;
 if v_actor is null or coalesce(v_active,false) is not true or v_role is distinct from 'cashier'::public.staff_role then
  raise exception using errcode='42501',message='Only an active Cashier can prepare a final bill.';
 end if;
 select * into v_enc from public.encounters where id=p_encounter_id for update;
 if not found or v_enc.status not in ('open','awaiting_discharge') then raise exception using errcode='P0002',message='An active encounter is required.'; end if;
 if v_enc.admitted_at is null or v_enc.bed_id is null then raise exception using errcode='22023',message='Only an admitted patient can receive a final inpatient bill.'; end if;
 if exists(select 1 from public.requests r where r.encounter_id=v_enc.id and r.status not in ('released'::public.request_status,'cancelled'::public.request_status)) then
  raise exception using errcode='22023',message='All medicine and laboratory requests must be fulfilled or cancelled before final billing.';
 end if;
 if exists(select 1 from public.requests r where r.encounter_id=v_enc.id and r.status <> 'cancelled'::public.request_status and not exists(select 1 from public.bills rb where rb.request_id=r.id and rb.paid_at is not null)) then
  raise exception using errcode='22023',message='Every request bill must be paid before final billing.';
 end if;
 select * into v_patient from public.patients where id=v_enc.patient_id for update;
 select * into v_bed from public.beds where id=v_enc.bed_id;
 select * into v_ward from public.wards where id=v_bed.ward_id;
 if v_enc.doctor_id is not null then select * into v_doctor from public.doctors where id=v_enc.doctor_id; end if;
 select * into v_existing from public.bills where encounter_id=v_enc.id and is_final=true for update;
 v_has_existing:=found;
 if v_has_existing then
  if v_existing.paid_at is not null then raise exception using errcode='22023',message='The final bill has already been paid.'; end if;
  -- Treat retries as idempotent: never silently reprice an already prepared bill.
  return v_existing.id;
 end if;
 v_days:=greatest(1,ceil(extract(epoch from (now()-v_enc.admitted_at))/86400.0)::integer);
 v_lodging:=round(v_days * case when v_bed.type='private'::public.bed_type then v_ward.private_daily_rate else v_ward.public_daily_rate end,2);
 v_doctor_fee:=coalesce(v_doctor.fixed_fee,0);
 v_subtotal:=round(v_lodging+v_doctor_fee,2);
 if p_use_philhealth then v_philhealth:=least(2000::numeric,v_subtotal); end if;
 if v_patient.pwd_or_senior then v_pwd:=round(greatest(0,v_subtotal-v_philhealth)*0.20,2); end if;
 v_total:=greatest(0,round(v_subtotal-v_philhealth-v_pwd,2));
 insert into public.bills(patient_id,encounter_id,subtotal,discount_category,discount_amount,total_bill,is_final,lodging_days,lodging_amount,doctor_fee,philhealth_discount,pwd_senior_discount)
   values(v_patient.id,v_enc.id,v_subtotal,case when p_use_philhealth then 'philhealth'::public.discount_type when v_patient.pwd_or_senior then 'pwd_senior'::public.discount_type else 'none'::public.discount_type end,
   v_philhealth+v_pwd,v_total,true,v_days,v_lodging,v_doctor_fee,v_philhealth,v_pwd)
   returning id into v_bill;
 update public.encounters set status='awaiting_discharge',updated_at=now() where id=v_enc.id;
 update public.patients set status='awaiting_discharge',updated_at=now() where id=v_patient.id;
 insert into public.audit_logs(actor_id,action,entity_type,entity_id,details)
 values(v_actor,'final_bill_prepared','encounter',v_enc.id::text,jsonb_build_object('bill_id',v_bill,'lodging_days',v_days,'lodging_amount',v_lodging,'doctor_fee',v_doctor_fee,'philhealth_discount',v_philhealth,'pwd_senior_discount',v_pwd,'total_bill',v_total));
 return v_bill;
end; $function$
;
