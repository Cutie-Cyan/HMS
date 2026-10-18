-- Two-phase paper-based Emergency Nurse encounter workflow.
alter table public.encounters
  add column if not exists workflow_stage text not null default 'recorded',
  add column if not exists doctor_form_returned_at timestamptz,
  add column if not exists findings_recorded_at timestamptz,
  add column if not exists findings_recorded_by uuid references auth.users(id);

alter table public.encounters drop constraint if exists encounters_workflow_stage_check;
alter table public.encounters add constraint encounters_workflow_stage_check
  check (workflow_stage in ('pending_doctor', 'for_encoding', 'recorded'));

update public.encounters
set workflow_stage = case
  when nullif(trim(coalesce(findings, '')), '') is null
    and nullif(trim(coalesce(recommendations, '')), '') is null then 'pending_doctor'
  else 'recorded'
end
where workflow_stage = 'recorded' and findings_recorded_at is null and doctor_form_returned_at is null;

create or replace function public.emergency_nurse_save_encounter_phase1(
  p_patient_id uuid, p_doctor_id uuid default null, p_encounter_id uuid default null
) returns uuid language plpgsql security definer set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid(); v_role public.staff_role; v_patient_status public.patient_status;
  v_doctor_id uuid := p_doctor_id; v_encounter_id uuid;
begin
  select sp.role into v_role from public.staff_profiles sp
  where sp.user_id = v_actor and sp.is_active = true;
  if v_actor is null or v_role is distinct from 'emergency_nurse'::public.staff_role then
    raise exception using errcode = '42501', message = 'Only an active Emergency Nurse can start an encounter.';
  end if;
  if p_patient_id is null then raise exception using errcode = '22023', message = 'Choose a patient.'; end if;
  select p.status into v_patient_status from public.patients p where p.id = p_patient_id for update;
  if v_patient_status is null then raise exception using errcode = 'P0002', message = 'Patient record not found.'; end if;
  if v_patient_status not in ('registered'::public.patient_status, 'in_emergency'::public.patient_status) then
    raise exception using errcode = '22023', message = 'Only a newly registered or emergency patient can receive an encounter form.';
  end if;
  if v_doctor_id is not null and not exists (select 1 from public.doctors d where d.id = v_doctor_id and d.is_active = true) then
    raise exception using errcode = '22023', message = 'Choose an active doctor record.';
  end if;
  if v_doctor_id is null then
    select d.id into v_doctor_id from public.doctors d where d.is_active = true and d.is_on_duty = true order by d.full_name limit 1;
  end if;
  if p_encounter_id is not null then
    update public.encounters set doctor_id = v_doctor_id, updated_at = now()
    where id = p_encounter_id and patient_id = p_patient_id and created_by = v_actor
      and status = 'open' and workflow_stage = 'pending_doctor' returning id into v_encounter_id;
    if v_encounter_id is null then raise exception using errcode = '42501', message = 'This encounter is not awaiting the initial form.'; end if;
  else
    if exists (select 1 from public.encounters e where e.patient_id = p_patient_id and e.status = 'open') then
      raise exception using errcode = '23505', message = 'This patient already has an open encounter. Select it from the queue.';
    end if;
    insert into public.encounters(patient_id, doctor_id, created_by, findings, recommendations, recommendation_type, status, workflow_stage)
    values (p_patient_id, v_doctor_id, v_actor, null, null, null, 'open', 'pending_doctor') returning id into v_encounter_id;
    update public.patients set status = 'in_emergency'::public.patient_status, updated_at = now()
    where id = p_patient_id and status = 'registered'::public.patient_status;
  end if;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, details)
  values (v_actor, case when p_encounter_id is null then 'encounter.phase1_saved' else 'encounter.phase1_updated' end,
    'encounter', v_encounter_id::text, jsonb_build_object('patient_id', p_patient_id, 'doctor_id', v_doctor_id));
  return v_encounter_id;
end;
$function$;

create or replace function public.emergency_nurse_mark_form_returned(p_encounter_id uuid)
returns void language plpgsql security definer set search_path = ''
as $function$
declare v_actor uuid := auth.uid();
begin
  if v_actor is null or not exists (select 1 from public.staff_profiles sp where sp.user_id = v_actor
    and sp.is_active = true and sp.role = 'emergency_nurse'::public.staff_role) then
    raise exception using errcode = '42501', message = 'Only an active Emergency Nurse can update the paper-form stage.';
  end if;
  update public.encounters set workflow_stage = 'for_encoding',
    doctor_form_returned_at = coalesce(doctor_form_returned_at, now()), updated_at = now()
  where id = p_encounter_id and created_by = v_actor and status = 'open' and workflow_stage = 'pending_doctor';
  if not found then raise exception using errcode = '22023', message = 'This encounter is not waiting for the doctor form.'; end if;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, details)
  values (v_actor, 'encounter.doctor_form_returned', 'encounter', p_encounter_id::text, '{}'::jsonb);
end;
$function$;

create or replace function public.emergency_nurse_record_doctor_findings(
  p_encounter_id uuid, p_findings text, p_recommendations text, p_recommendation_type text
) returns uuid language plpgsql security definer set search_path = ''
as $function$
declare v_actor uuid := auth.uid(); v_id uuid;
begin
  if v_actor is null or not exists (select 1 from public.staff_profiles sp where sp.user_id = v_actor
    and sp.is_active = true and sp.role = 'emergency_nurse'::public.staff_role) then
    raise exception using errcode = '42501', message = 'Only an active Emergency Nurse can encode the doctor form.';
  end if;
  if nullif(trim(coalesce(p_findings, '')), '') is null then raise exception using errcode = '22023', message = 'Enter the findings written by the doctor.'; end if;
  if nullif(trim(coalesce(p_recommendations, '')), '') is null then raise exception using errcode = '22023', message = 'Enter the recommendations written by the doctor.'; end if;
  if p_recommendation_type is not null and p_recommendation_type not in ('consult','lab','medicine','mixed') then
    raise exception using errcode = '22023', message = 'Choose a valid recommendation type.';
  end if;
  update public.encounters set findings = nullif(trim(p_findings), ''), recommendations = nullif(trim(p_recommendations), ''),
    recommendation_type = p_recommendation_type, workflow_stage = 'recorded', findings_recorded_at = now(),
    findings_recorded_by = v_actor, updated_at = now()
  where id = p_encounter_id and created_by = v_actor and status = 'open' and workflow_stage = 'for_encoding'
  returning id into v_id;
  if v_id is null then raise exception using errcode = '22023', message = 'Mark the returned paper form before encoding it.'; end if;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, details)
  values (v_actor, 'encounter.doctor_findings_encoded', 'encounter', v_id::text, jsonb_build_object('recommendation_type', p_recommendation_type));
  return v_id;
end;
$function$;

drop function if exists public.staff_encounter_queue(text);
create function public.staff_encounter_queue(p_status text default null)
returns table(
  encounter_id uuid, patient_id uuid, patient_number text, patient_name text, doctor_id uuid, doctor_name text,
  findings text, recommendations text, recommendation_type text, encounter_status text, admitted_at timestamptz,
  discharged_at timestamptz, bed_id uuid, patient_status public.patient_status, current_ward_id uuid,
  created_at timestamptz, workflow_stage text, doctor_form_returned_at timestamptz,
  findings_recorded_at timestamptz, findings_recorded_by uuid
) language plpgsql stable security definer set search_path = ''
as $function$
declare v_actor uuid := auth.uid(); v_role public.staff_role; v_ward uuid;
begin
  select sp.role, sp.ward_id into v_role, v_ward from public.staff_profiles sp where sp.user_id = v_actor and sp.is_active = true;
  if v_actor is null or v_role is null or v_role not in ('emergency_nurse'::public.staff_role, 'nurse_station'::public.staff_role) then
    raise exception using errcode = '42501', message = 'Emergency Nurse or Nurse Station access is required.';
  end if;
  if p_status is not null and p_status not in ('open', 'awaiting_discharge', 'closed') then
    raise exception using errcode = '22023', message = 'Invalid encounter status filter.';
  end if;
  return query select e.id, p.id, p.patient_number, trim(concat_ws(' ', p.first_name, p.middle_name, p.last_name)),
    e.doctor_id, d.full_name, e.findings, e.recommendations, e.recommendation_type, e.status,
    e.admitted_at, e.discharged_at, e.bed_id, p.status, p.current_ward_id, e.created_at,
    e.workflow_stage, e.doctor_form_returned_at, e.findings_recorded_at, e.findings_recorded_by
  from public.encounters e join public.patients p on p.id = e.patient_id
  left join public.doctors d on d.id = e.doctor_id left join public.beds b on b.id = e.bed_id
  where (p_status is null or e.status = p_status) and (v_role = 'emergency_nurse'::public.staff_role
    or (v_role = 'nurse_station'::public.staff_role and (p.current_ward_id = v_ward or b.ward_id = v_ward)))
  order by e.created_at desc limit 100;
end;
$function$;

revoke all on function public.emergency_nurse_save_encounter_phase1(uuid, uuid, uuid) from public, anon;
revoke all on function public.emergency_nurse_mark_form_returned(uuid) from public, anon;
revoke all on function public.emergency_nurse_record_doctor_findings(uuid, text, text, text) from public, anon;
grant execute on function public.emergency_nurse_save_encounter_phase1(uuid, uuid, uuid) to authenticated;
grant execute on function public.emergency_nurse_mark_form_returned(uuid) to authenticated;
grant execute on function public.emergency_nurse_record_doctor_findings(uuid, text, text, text) to authenticated;
grant execute on function public.staff_encounter_queue(text) to authenticated;
