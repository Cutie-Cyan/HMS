-- Step 10 regression fix: preserve saved final-bill amounts in the queue.
-- Before a bill is prepared, lodging and doctor fees remain live estimates.
-- Once a final bill exists, the queue displays the saved snapshot rather than
-- recalculating from current rates or doctor settings.
CREATE OR REPLACE FUNCTION public.staff_final_billing_queue()
 RETURNS TABLE(encounter_id uuid, patient_id uuid, patient_number text, patient_name text, ward_name text, bed_code text, bed_type public.bed_type, admitted_at timestamp with time zone, lodging_days integer, lodging_amount numeric, doctor_name text, doctor_fee numeric, pwd_or_senior boolean, requests_cleared boolean, final_bill_id uuid, subtotal numeric, philhealth_discount numeric, pwd_senior_discount numeric, total_bill numeric, paid_at timestamp with time zone)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
declare v_role public.staff_role; v_active boolean; v_ward uuid;
begin
 select sp.role,sp.is_active,sp.ward_id into v_role,v_active,v_ward
 from public.staff_profiles sp where sp.user_id=auth.uid();
 if auth.uid() is null or coalesce(v_active,false) is not true or v_role not in ('cashier','nurse_station') then
  raise exception using errcode='42501',message='Cashier or Nurse Station access is required.';
 end if;
 return query
 select e.id,p.id,p.patient_number,trim(concat_ws(' ',p.first_name,p.middle_name,p.last_name)),
  w.name::text,b.bed_code,b.type,e.admitted_at,
  coalesce(fb.lodging_days,
   case when e.admitted_at is null then 0 else greatest(1,ceil(extract(epoch from (coalesce(e.discharged_at,now())-e.admitted_at))/86400.0)::integer) end),
  coalesce(fb.lodging_amount,
   case when e.admitted_at is null or b.id is null then 0::numeric else
    (greatest(1,ceil(extract(epoch from (coalesce(e.discharged_at,now())-e.admitted_at))/86400.0)::integer) *
    case when b.type='private'::public.bed_type then w.private_daily_rate else w.public_daily_rate end)::numeric(12,2) end),
  d.full_name,coalesce(fb.doctor_fee,d.fixed_fee,0)::numeric,
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
end; $function$;
revoke all on function public.staff_final_billing_queue() from public,anon;
grant execute on function public.staff_final_billing_queue() to authenticated;
