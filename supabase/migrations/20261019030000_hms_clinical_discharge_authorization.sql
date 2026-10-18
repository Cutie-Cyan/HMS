alter table public.encounters
  add column if not exists doctor_discharge_order_at timestamptz,
  add column if not exists doctor_discharge_order_recorded_by uuid references auth.users(id),
  add column if not exists doctor_discharge_order_note text;

create or replace function public.nurse_station_record_discharge_order(
  p_encounter_id uuid,
  p_order_note text
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_role public.staff_role;
  v_active boolean;
  v_ward uuid;
  v_enc public.encounters%rowtype;
  v_patient public.patients%rowtype;
begin
  select sp.role, sp.is_active, sp.ward_id
    into v_role, v_active, v_ward
  from public.staff_profiles sp where sp.user_id = v_actor;

  if v_actor is null or coalesce(v_active,false) is not true
     or v_role is distinct from 'nurse_station'::public.staff_role
     or v_ward is null then
    raise exception using errcode='42501', message='An active assigned Nurse Station account is required.';
  end if;

  if nullif(btrim(p_order_note), '') is null then
    raise exception using errcode='22023', message='Record the doctor discharge order details before continuing.';
  end if;

  select * into v_enc from public.encounters where id=p_encounter_id for update;
  if not found or v_enc.status not in ('open','awaiting_discharge') or v_enc.bed_id is null then
    raise exception using errcode='22023', message='An admitted patient with an active encounter is required.';
  end if;

  select * into v_patient from public.patients where id=v_enc.patient_id for update;
  if v_patient.current_ward_id is distinct from v_ward then
    raise exception using errcode='42501', message='You can only record discharge orders for patients assigned to your ward.';
  end if;

  update public.encounters
    set doctor_discharge_order_at=now(),
        doctor_discharge_order_recorded_by=v_actor,
        doctor_discharge_order_note=btrim(p_order_note),
        updated_at=now()
    where id=v_enc.id;

  insert into public.audit_logs(actor_id,action,entity_type,entity_id,details)
  values(v_actor,'doctor_discharge_order_recorded','encounter',v_enc.id::text,
    jsonb_build_object('ward_id',v_ward,'order_note',btrim(p_order_note)));

  return v_enc.id;
end;
$$;

create or replace function public.nurse_station_discharge_patient(p_encounter_id uuid)
 returns uuid language plpgsql security definer set search_path to ''
as $function$
declare
 v_actor uuid:=auth.uid(); v_role public.staff_role; v_active boolean; v_ward uuid;
 v_enc public.encounters%rowtype; v_patient public.patients%rowtype; v_bill public.bills%rowtype;
begin
 select sp.role,sp.is_active,sp.ward_id into v_role,v_active,v_ward from public.staff_profiles sp where sp.user_id=v_actor;
 if v_actor is null or coalesce(v_active,false) is not true or v_role is distinct from 'nurse_station'::public.staff_role or v_ward is null then
  raise exception using errcode='42501',message='An active assigned Nurse Station account is required to discharge a patient.';
 end if;
 select * into v_enc from public.encounters where id=p_encounter_id for update;
 if not found or v_enc.status<>'awaiting_discharge' or v_enc.bed_id is null then
  raise exception using errcode='22023',message='Patient must be admitted and awaiting discharge.';
 end if;
 select * into v_patient from public.patients where id=v_enc.patient_id for update;
 if v_patient.current_ward_id is distinct from v_ward then
  raise exception using errcode='42501',message='You can only discharge patients assigned to your ward.';
 end if;
 if v_enc.doctor_discharge_order_at is null or nullif(btrim(v_enc.doctor_discharge_order_note),'') is null then
  raise exception using errcode='22023',message='A recorded doctor discharge order is required before discharge.';
 end if;
 select * into v_bill from public.bills where encounter_id=v_enc.id and is_final=true;
 if not found or v_bill.paid_at is null then
  raise exception using errcode='22023',message='Final bill must be paid before discharge.';
 end if;
 if exists(select 1 from public.requests r where r.encounter_id=v_enc.id and r.status not in ('released'::public.request_status,'cancelled'::public.request_status)) or
    exists(select 1 from public.requests r where r.encounter_id=v_enc.id and r.status <> 'cancelled'::public.request_status and not exists(select 1 from public.bills rb where rb.request_id=r.id and rb.paid_at is not null)) then
  raise exception using errcode='22023',message='All requests must be fulfilled and paid before discharge.';
 end if;
 update public.encounters set status='closed',discharged_at=now(),bed_id=null,updated_at=now() where id=v_enc.id;
 update public.patients set status='discharged',current_ward_id=null,updated_at=now() where id=v_patient.id;
 insert into public.audit_logs(actor_id,action,entity_type,entity_id,details)
 values(v_actor,'patient.discharged','encounter',v_enc.id::text,
 jsonb_build_object('patient_id',v_patient.id,'bill_id',v_bill.id,'ward_id',v_ward,'total_bill',v_bill.total_bill,'doctor_order_at',v_enc.doctor_discharge_order_at));
 return v_enc.id;
end;
$function$;

revoke all on function public.nurse_station_record_discharge_order(uuid,text) from public, anon;
grant execute on function public.nurse_station_record_discharge_order(uuid,text) to authenticated;
revoke all on function public.nurse_station_discharge_patient(uuid) from public, anon;
grant execute on function public.nurse_station_discharge_patient(uuid) to authenticated;