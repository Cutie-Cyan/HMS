-- Step 9: server-calculated inpatient final billing and guarded discharge.
alter table public.bills
 add column if not exists lodging_days integer not null default 0 check (lodging_days >= 0),
 add column if not exists lodging_amount numeric(12,2) not null default 0 check (lodging_amount >= 0),
 add column if not exists doctor_fee numeric(12,2) not null default 0 check (doctor_fee >= 0),
 add column if not exists philhealth_discount numeric(12,2) not null default 0 check (philhealth_discount >= 0),
 add column if not exists pwd_senior_discount numeric(12,2) not null default 0 check (pwd_senior_discount >= 0);
create unique index if not exists bills_one_final_per_encounter on public.bills(encounter_id) where is_final=true;

CREATE OR REPLACE FUNCTION public.cashier_pay_final_bill(p_bill_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_actor uuid:=auth.uid(); v_role public.staff_role; v_active boolean; v_bill public.bills%rowtype;
begin
 select sp.role,sp.is_active into v_role,v_active from public.staff_profiles sp where sp.user_id=v_actor;
 if v_actor is null or coalesce(v_active,false) is not true or v_role is distinct from 'cashier'::public.staff_role then
  raise exception using errcode='42501',message='Only an active Cashier can record final-bill payment.';
 end if;
 select * into v_bill from public.bills where id=p_bill_id and is_final=true for update;
 if not found then raise exception using errcode='P0002',message='Final bill not found.'; end if;
 if v_bill.paid_at is not null then raise exception using errcode='22023',message='Final bill has already been paid.'; end if;
 if exists(select 1 from public.requests r where r.encounter_id=v_bill.encounter_id and r.status not in ('released'::public.request_status,'cancelled'::public.request_status)) or
    exists(select 1 from public.requests r where r.encounter_id=v_bill.encounter_id and r.status <> 'cancelled'::public.request_status and not exists(select 1 from public.bills rb where rb.request_id=r.id and rb.paid_at is not null)) then
  raise exception using errcode='22023',message='Requests must be fulfilled and all request charges paid before final payment.';
 end if;
 update public.bills set paid_at=now(),paid_by=v_actor,updated_at=now() where id=p_bill_id;
 insert into public.audit_logs(actor_id,action,entity_type,entity_id,details)
 values(v_actor,'final_bill_paid','bill',p_bill_id::text,jsonb_build_object('encounter_id',v_bill.encounter_id,'amount',v_bill.total_bill));
 return p_bill_id;
end; $function$
;

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
 if v_has_existing and v_existing.paid_at is not null then raise exception using errcode='22023',message='The final bill has already been paid.'; end if;
 v_days:=greatest(1,ceil(extract(epoch from (now()-v_enc.admitted_at))/86400.0)::integer);
 v_lodging:=round(v_days * case when v_bed.type='private'::public.bed_type then v_ward.private_daily_rate else v_ward.public_daily_rate end,2);
 v_doctor_fee:=coalesce(v_doctor.fixed_fee,0);
 v_subtotal:=round(v_lodging+v_doctor_fee,2);
 if p_use_philhealth then v_philhealth:=least(2000::numeric,v_subtotal); end if;
 if v_patient.pwd_or_senior then v_pwd:=round(greatest(0,v_subtotal-v_philhealth)*0.20,2); end if;
 v_total:=greatest(0,round(v_subtotal-v_philhealth-v_pwd,2));
 if v_has_existing then
  update public.bills set subtotal=v_subtotal,discount_category=case when p_use_philhealth then 'philhealth'::public.discount_type when v_patient.pwd_or_senior then 'pwd_senior'::public.discount_type else 'none'::public.discount_type end,
   discount_amount=v_philhealth+v_pwd,total_bill=v_total,lodging_days=v_days,lodging_amount=v_lodging,doctor_fee=v_doctor_fee,
   philhealth_discount=v_philhealth,pwd_senior_discount=v_pwd,updated_at=now()
   where id=v_existing.id returning id into v_bill;
 else
  insert into public.bills(patient_id,encounter_id,subtotal,discount_category,discount_amount,total_bill,is_final,lodging_days,lodging_amount,doctor_fee,philhealth_discount,pwd_senior_discount)
   values(v_patient.id,v_enc.id,v_subtotal,case when p_use_philhealth then 'philhealth'::public.discount_type when v_patient.pwd_or_senior then 'pwd_senior'::public.discount_type else 'none'::public.discount_type end,
   v_philhealth+v_pwd,v_total,true,v_days,v_lodging,v_doctor_fee,v_philhealth,v_pwd)
   returning id into v_bill;
 end if;
 update public.encounters set status='awaiting_discharge',updated_at=now() where id=v_enc.id;
 update public.patients set status='awaiting_discharge',updated_at=now() where id=v_patient.id;
 insert into public.audit_logs(actor_id,action,entity_type,entity_id,details)
 values(v_actor,'final_bill_prepared','encounter',v_enc.id::text,jsonb_build_object('bill_id',v_bill,'lodging_days',v_days,'lodging_amount',v_lodging,'doctor_fee',v_doctor_fee,'philhealth_discount',v_philhealth,'pwd_senior_discount',v_pwd,'total_bill',v_total));
 return v_bill;
end; $function$
;

CREATE OR REPLACE FUNCTION public.nurse_station_discharge_patient(p_encounter_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_actor uuid:=auth.uid(); v_role public.staff_role; v_active boolean; v_ward uuid;
 v_enc public.encounters%rowtype; v_patient public.patients%rowtype; v_bill public.bills%rowtype;
begin
 select sp.role,sp.is_active,sp.ward_id into v_role,v_active,v_ward from public.staff_profiles sp where sp.user_id=v_actor;
 if v_actor is null or coalesce(v_active,false) is not true or v_role is distinct from 'nurse_station'::public.staff_role or v_ward is null then
  raise exception using errcode='42501',message='An active assigned Nurse Station account is required to discharge a patient.';
 end if;
 select * into v_enc from public.encounters where id=p_encounter_id for update;
 if not found or v_enc.status<>'awaiting_discharge' or v_enc.bed_id is null then raise exception using errcode='22023',message='Patient must be admitted and awaiting discharge.'; end if;
 select * into v_patient from public.patients where id=v_enc.patient_id for update;
 if v_patient.current_ward_id is distinct from v_ward then raise exception using errcode='42501',message='You can only discharge patients assigned to your ward.'; end if;
 select * into v_bill from public.bills where encounter_id=v_enc.id and is_final=true;
 if not found or v_bill.paid_at is null then raise exception using errcode='22023',message='Final bill must be paid before discharge.'; end if;
 if exists(select 1 from public.requests r where r.encounter_id=v_enc.id and r.status not in ('released'::public.request_status,'cancelled'::public.request_status)) or
    exists(select 1 from public.requests r where r.encounter_id=v_enc.id and r.status <> 'cancelled'::public.request_status and not exists(select 1 from public.bills rb where rb.request_id=r.id and rb.paid_at is not null)) then
  raise exception using errcode='22023',message='All requests must be fulfilled and paid before discharge.';
 end if;
 update public.encounters set status='closed',discharged_at=now(),bed_id=null,updated_at=now() where id=v_enc.id;
 update public.patients set status='discharged',current_ward_id=null,updated_at=now() where id=v_patient.id;
 insert into public.audit_logs(actor_id,action,entity_type,entity_id,details)
 values(v_actor,'patient.discharged','encounter',v_enc.id::text,jsonb_build_object('patient_id',v_patient.id,'bill_id',v_bill.id,'ward_id',v_ward,'total_bill',v_bill.total_bill));
 return v_enc.id;
end; $function$
;

CREATE OR REPLACE FUNCTION public.staff_final_billing_queue()
 RETURNS TABLE(encounter_id uuid, patient_id uuid, patient_number text, patient_name text, ward_name text, bed_code text, bed_type bed_type, admitted_at timestamp with time zone, lodging_days integer, lodging_amount numeric, doctor_name text, doctor_fee numeric, pwd_or_senior boolean, requests_cleared boolean, final_bill_id uuid, subtotal numeric, philhealth_discount numeric, pwd_senior_discount numeric, total_bill numeric, paid_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_role public.staff_role; v_active boolean; v_ward uuid;
begin
 select sp.role,sp.is_active,sp.ward_id into v_role,v_active,v_ward from public.staff_profiles sp where sp.user_id=auth.uid();
 if auth.uid() is null or coalesce(v_active,false) is not true or v_role not in ('cashier','nurse_station') then
  raise exception using errcode='42501',message='Cashier or Nurse Station access is required.';
 end if;
 return query
 select e.id,p.id,p.patient_number,trim(concat_ws(' ',p.first_name,p.middle_name,p.last_name)),
  w.name::text,b.bed_code,b.type,e.admitted_at,
  case when e.admitted_at is null then 0 else greatest(1,ceil(extract(epoch from (coalesce(e.discharged_at,now())-e.admitted_at))/86400.0)::integer) end,
  case when e.admitted_at is null or b.id is null then 0::numeric else
    (greatest(1,ceil(extract(epoch from (coalesce(e.discharged_at,now())-e.admitted_at))/86400.0)::integer) *
    case when b.type='private'::public.bed_type then w.private_daily_rate else w.public_daily_rate end)::numeric(12,2) end,
  d.full_name,coalesce(d.fixed_fee,0)::numeric,
  p.pwd_or_senior,
  not exists(select 1 from public.requests r where r.encounter_id=e.id and r.status not in ('released'::public.request_status,'cancelled'::public.request_status))
    and not exists(select 1 from public.requests r where r.encounter_id=e.id and r.status <> 'cancelled'::public.request_status and not exists(select 1 from public.bills rb where rb.request_id=r.id and rb.paid_at is not null)),
  fb.id,coalesce(fb.subtotal,0),coalesce(fb.philhealth_discount,0),coalesce(fb.pwd_senior_discount,0),
  coalesce(fb.total_bill,0),fb.paid_at
 from public.encounters e
 join public.patients p on p.id=e.patient_id
 left join public.doctors d on d.id=e.doctor_id
 left join public.beds b on b.id=e.bed_id
 left join public.wards w on w.id=b.ward_id
 left join public.bills fb on fb.encounter_id=e.id and fb.is_final=true
 where e.status in ('open','awaiting_discharge') and e.admitted_at is not null and e.bed_id is not null
  and (v_role='cashier' or (p.current_ward_id=v_ward and v_role='nurse_station'))
 order by e.admitted_at nulls last,e.created_at;
end; $function$
;

revoke all on function public.staff_final_billing_queue() from public,anon;
revoke all on function public.cashier_prepare_final_bill(uuid,boolean) from public,anon;
revoke all on function public.cashier_pay_final_bill(uuid) from public,anon;
revoke all on function public.nurse_station_discharge_patient(uuid) from public,anon;
grant execute on function public.staff_final_billing_queue() to authenticated;
grant execute on function public.cashier_prepare_final_bill(uuid,boolean) to authenticated;
grant execute on function public.cashier_pay_final_bill(uuid) to authenticated;
grant execute on function public.nurse_station_discharge_patient(uuid) to authenticated;
