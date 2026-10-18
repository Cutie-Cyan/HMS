-- ER encounter workflow and ward ownership enforcement.
-- All ward staff may use the shared patient directory; clinical actions stay scoped
-- to the patient's current ward, with the ER allowed to initiate and disposition ER cases.

create or replace function public.emergency_nurse_save_encounter_phase1(
  p_patient_id uuid, p_doctor_id uuid default null, p_encounter_id uuid default null
) returns uuid language plpgsql security definer set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_role public.staff_role;
  v_patient_status public.patient_status;
  v_current_ward uuid;
  v_er_ward uuid;
  v_doctor_id uuid := p_doctor_id;
  v_encounter_id uuid;
begin
  select sp.role into v_role from public.staff_profiles sp
  where sp.user_id = v_actor and sp.is_active = true;
  if v_actor is null or v_role is distinct from 'emergency_nurse'::public.staff_role then
    raise exception using errcode = '42501', message = 'Only an active Emergency Nurse can start an encounter.';
  end if;
  select w.id into v_er_ward from public.wards w where w.name = 'Emergency Room'::public.ward_name and w.is_active = true;
  if v_er_ward is null then
    raise exception using errcode = '22023', message = 'The Emergency Room ward is not configured.';
  end if;
  if p_patient_id is null then raise exception using errcode = '22023', message = 'Choose a patient.'; end if;
  select p.status, p.current_ward_id into v_patient_status, v_current_ward
  from public.patients p where p.id = p_patient_id for update;
  if v_patient_status is null then raise exception using errcode = 'P0002', message = 'Patient record not found.'; end if;
  if v_patient_status not in ('registered'::public.patient_status, 'in_emergency'::public.patient_status) then
    raise exception using errcode = '22023', message = 'Only a newly registered or emergency patient can receive an encounter form.';
  end if;
  if v_current_ward is not null and v_current_ward <> v_er_ward then
    raise exception using errcode = '42501', message = 'This patient is assigned to another ward. The Emergency Room cannot edit that ward''s active patient.';
  end if;
  if v_doctor_id is not null and not exists (select 1 from public.doctors d where d.id = v_doctor_id and d.is_active = true) then
    raise exception using errcode = '22023', message = 'Choose an active doctor record.';
  end if;
  if v_doctor_id is null then
    select d.id into v_doctor_id from public.doctors d where d.is_active = true and d.is_on_duty = true order by d.full_name limit 1;
  end if;
  if p_encounter_id is not null then
    update public.encounters
    set doctor_id = v_doctor_id, updated_at = now()
    where id = p_encounter_id and patient_id = p_patient_id and status = 'open' and workflow_stage = 'pending_doctor'
      and exists (select 1 from public.patients p where p.id = public.encounters.patient_id
        and (p.current_ward_id = v_er_ward or (p.current_ward_id is null and p.status = 'in_emergency'::public.patient_status)))
    returning id into v_encounter_id;
    if v_encounter_id is null then raise exception using errcode = '42501', message = 'This encounter is not awaiting the initial form in the Emergency Room.'; end if;
  else
    if exists (select 1 from public.encounters e where e.patient_id = p_patient_id and e.status = 'open') then
      raise exception using errcode = '23505', message = 'This patient already has an open encounter. Select it from the queue.';
    end if;
    insert into public.encounters(patient_id, doctor_id, created_by, findings, recommendations, recommendation_type, status, workflow_stage)
    values (p_patient_id, v_doctor_id, v_actor, null, null, null, 'open', 'pending_doctor') returning id into v_encounter_id;
  end if;
  update public.patients set status = 'in_emergency'::public.patient_status, current_ward_id = v_er_ward, updated_at = now()
  where id = p_patient_id;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, details)
  values (v_actor, case when p_encounter_id is null then 'encounter.phase1_saved' else 'encounter.phase1_updated' end,
    'encounter', v_encounter_id::text, jsonb_build_object('patient_id', p_patient_id, 'doctor_id', v_doctor_id, 'ward_id', v_er_ward));
  return v_encounter_id;
end;
$function$;

create or replace function public.emergency_nurse_save_encounter_phase1_with_notes(
  p_patient_id uuid, p_doctor_id uuid default null, p_encounter_id uuid default null, p_nurse_assessment text default null
) returns uuid language plpgsql security definer set search_path = ''
as $function$
declare v_id uuid;
begin
  v_id := public.emergency_nurse_save_encounter_phase1(p_patient_id, p_doctor_id, p_encounter_id);
  update public.encounters e set nurse_assessment = nullif(trim(coalesce(p_nurse_assessment, '')), ''), updated_at = now()
  where e.id = v_id and e.workflow_stage = 'pending_doctor'
    and exists (select 1 from public.patients p join public.wards w on w.id = p.current_ward_id
      where p.id = e.patient_id and w.name = 'Emergency Room'::public.ward_name);
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'encounter.nurse_assessment_saved', 'encounter', v_id::text,
    jsonb_build_object('assessment_provided', nullif(trim(coalesce(p_nurse_assessment, '')), '') is not null));
  return v_id;
end;
$function$;

create or replace function public.emergency_nurse_mark_form_returned(p_encounter_id uuid)
returns void language plpgsql security definer set search_path = ''
as $function$
declare v_actor uuid := auth.uid(); v_er_ward uuid;
begin
  if v_actor is null or not exists (select 1 from public.staff_profiles sp where sp.user_id = v_actor
    and sp.is_active = true and sp.role = 'emergency_nurse'::public.staff_role) then
    raise exception using errcode = '42501', message = 'Only an active Emergency Nurse can update the paper-form stage.';
  end if;
  select w.id into v_er_ward from public.wards w where w.name = 'Emergency Room'::public.ward_name and w.is_active = true;
  update public.encounters e set workflow_stage = 'for_encoding',
    doctor_form_returned_at = coalesce(e.doctor_form_returned_at, now()), updated_at = now()
  where e.id = p_encounter_id and e.status = 'open' and e.workflow_stage = 'pending_doctor'
    and exists (select 1 from public.patients p where p.id = e.patient_id
      and (p.current_ward_id = v_er_ward or (p.current_ward_id is null and p.status = 'in_emergency'::public.patient_status)));
  if not found then raise exception using errcode = '22023', message = 'This encounter is not waiting for the doctor form in the Emergency Room.'; end if;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, details)
  values (v_actor, 'encounter.doctor_form_returned', 'encounter', p_encounter_id::text, '{}'::jsonb);
end;
$function$;

create or replace function public.emergency_nurse_record_doctor_findings(
  p_encounter_id uuid, p_findings text, p_recommendations text, p_recommendation_type text
) returns uuid language plpgsql security definer set search_path = ''
as $function$
declare v_actor uuid := auth.uid(); v_id uuid; v_er_ward uuid;
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
  select w.id into v_er_ward from public.wards w where w.name = 'Emergency Room'::public.ward_name and w.is_active = true;
  update public.encounters e set findings = nullif(trim(p_findings), ''), recommendations = nullif(trim(p_recommendations), ''),
    recommendation_type = p_recommendation_type, workflow_stage = 'recorded', findings_recorded_at = now(),
    findings_recorded_by = v_actor, updated_at = now()
  where e.id = p_encounter_id and e.status = 'open' and e.workflow_stage = 'for_encoding'
    and exists (select 1 from public.patients p where p.id = e.patient_id
      and (p.current_ward_id = v_er_ward or (p.current_ward_id is null and p.status = 'in_emergency'::public.patient_status)))
  returning e.id into v_id;
  if v_id is null then raise exception using errcode = '22023', message = 'Mark the returned paper form before encoding it, and ensure the patient is still assigned to the Emergency Room.'; end if;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, details)
  values (v_actor, 'encounter.doctor_findings_encoded', 'encounter', v_id::text, jsonb_build_object('recommendation_type', p_recommendation_type));
  return v_id;
end;
$function$;

create or replace function public.staff_encounter_queue(p_status text default null)
returns table(
  encounter_id uuid, patient_id uuid, patient_number text, patient_name text, doctor_id uuid, doctor_name text,
  findings text, recommendations text, recommendation_type text, encounter_status text, admitted_at timestamptz,
  discharged_at timestamptz, bed_id uuid, patient_status public.patient_status, current_ward_id uuid,
  created_at timestamptz, workflow_stage text, doctor_form_returned_at timestamptz,
  findings_recorded_at timestamptz, findings_recorded_by uuid, nurse_assessment text
) language plpgsql stable security definer set search_path = ''
as $function$
declare v_actor uuid := auth.uid(); v_role public.staff_role; v_ward uuid; v_er_ward uuid;
begin
  select sp.role, sp.ward_id into v_role, v_ward from public.staff_profiles sp where sp.user_id = v_actor and sp.is_active = true;
  if v_actor is null or v_role is null or v_role not in ('emergency_nurse'::public.staff_role, 'nurse_station'::public.staff_role) then
    raise exception using errcode = '42501', message = 'Emergency Nurse or Nurse Station access is required.';
  end if;
  if p_status is not null and p_status not in ('open', 'awaiting_discharge', 'closed') then
    raise exception using errcode = '22023', message = 'Invalid encounter status filter.';
  end if;
  select w.id into v_er_ward from public.wards w where w.name = 'Emergency Room'::public.ward_name and w.is_active = true;
  if v_role = 'nurse_station'::public.staff_role and v_ward is null then
    raise exception using errcode = '42501', message = 'An assigned ward is required for Nurse Station access.';
  end if;
  return query select e.id, p.id, p.patient_number, trim(concat_ws(' ', p.first_name, p.middle_name, p.last_name)),
    e.doctor_id, d.full_name, e.findings, e.recommendations, e.recommendation_type, e.status, e.admitted_at,
    e.discharged_at, e.bed_id, p.status, p.current_ward_id, e.created_at, e.workflow_stage,
    e.doctor_form_returned_at, e.findings_recorded_at, e.findings_recorded_by, e.nurse_assessment
  from public.encounters e join public.patients p on p.id = e.patient_id
  left join public.doctors d on d.id = e.doctor_id left join public.beds b on b.id = e.bed_id
  where (p_status is null or e.status = p_status) and (
    (v_role = 'emergency_nurse'::public.staff_role and
      (p.current_ward_id = v_er_ward or (p.current_ward_id is null and p.status = 'in_emergency'::public.patient_status and e.created_by = v_actor)))
    or (v_role = 'nurse_station'::public.staff_role and (p.current_ward_id = v_ward or b.ward_id = v_ward))
  )
  order by e.created_at desc limit 100;
end;
$function$;

create or replace function public.emergency_nurse_admit_patient(p_encounter_id uuid, p_bed_id uuid)
returns uuid language plpgsql security definer set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid(); v_role public.staff_role;
  v_enc public.encounters%rowtype; v_patient public.patients%rowtype;
  v_bed public.beds%rowtype; v_room public.rooms%rowtype; v_er_ward uuid;
begin
  select sp.role into v_role from public.staff_profiles sp where sp.user_id = v_actor and sp.is_active = true;
  if v_actor is null or v_role is distinct from 'emergency_nurse'::public.staff_role then
    raise exception using errcode = '42501', message = 'Only an active Emergency Nurse can admit a patient.';
  end if;
  select w.id into v_er_ward from public.wards w where w.name = 'Emergency Room'::public.ward_name and w.is_active = true;
  select * into v_enc from public.encounters where id = p_encounter_id for update;
  if not found or v_enc.status <> 'open' then raise exception using errcode = 'P0002', message = 'An open encounter is required for admission.'; end if;
  select * into v_patient from public.patients where id = v_enc.patient_id for update;
  if v_patient.status = 'discharged' then raise exception using errcode = '22023', message = 'A discharged patient cannot be admitted from this encounter.'; end if;
  if v_patient.current_ward_id is distinct from v_er_ward
     and not (v_patient.current_ward_id is null and v_patient.status = 'in_emergency'::public.patient_status) then
    raise exception using errcode = '42501', message = 'The patient is no longer assigned to the Emergency Room.';
  end if;
  select * into v_bed from public.beds where id = p_bed_id and is_active = true for update;
  if not found then raise exception using errcode = '22023', message = 'Choose an active bed.'; end if;
  if not exists (select 1 from public.wards where id = v_bed.ward_id and is_active = true) then
    raise exception using errcode = '22023', message = 'Choose a bed in an active ward.';
  end if;
  if exists (select 1 from public.encounters where bed_id = p_bed_id and status <> 'closed' and id <> p_encounter_id) then
    raise exception using errcode = '23505', message = 'That bed is already occupied.'; end if;
  if v_bed.type = 'private' then
    select * into v_room from public.rooms where id = v_bed.room_id and is_active = true for update;
    if not found or not v_room.is_private then raise exception using errcode = '22023', message = 'A private bed must be in an active private room.'; end if;
    if exists (select 1 from public.encounters en join public.beds b on b.id = en.bed_id
      where b.room_id = v_room.id and en.status <> 'closed' and en.id <> p_encounter_id) then
      raise exception using errcode = '23505', message = 'The private room is already occupied.'; end if;
  end if;
  update public.encounters set bed_id = p_bed_id, admitted_at = coalesce(admitted_at, now()), updated_at = now() where id = p_encounter_id;
  update public.patients set status = 'admitted'::public.patient_status, current_ward_id = v_bed.ward_id, updated_at = now() where id = v_patient.id;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, details)
  values (v_actor, 'patient.admitted', 'encounter', p_encounter_id::text,
    jsonb_build_object('patient_id', v_patient.id, 'ward_id', v_bed.ward_id, 'bed_id', v_bed.id, 'bed_type', v_bed.type));
  return p_encounter_id;
end;
$function$;

revoke all on function public.emergency_nurse_save_encounter_phase1(uuid, uuid, uuid) from public, anon;
revoke all on function public.emergency_nurse_save_encounter_phase1_with_notes(uuid, uuid, uuid, text) from public, anon;
revoke all on function public.emergency_nurse_mark_form_returned(uuid) from public, anon;
revoke all on function public.emergency_nurse_record_doctor_findings(uuid, text, text, text) from public, anon;
revoke all on function public.staff_encounter_queue(text) from public, anon;
revoke all on function public.emergency_nurse_admit_patient(uuid, uuid) from public, anon;
grant execute on function public.emergency_nurse_save_encounter_phase1(uuid, uuid, uuid) to authenticated;
grant execute on function public.emergency_nurse_save_encounter_phase1_with_notes(uuid, uuid, uuid, text) to authenticated;
grant execute on function public.emergency_nurse_mark_form_returned(uuid) to authenticated;
grant execute on function public.emergency_nurse_record_doctor_findings(uuid, text, text, text) to authenticated;
grant execute on function public.staff_encounter_queue(text) to authenticated;
grant execute on function public.emergency_nurse_admit_patient(uuid, uuid) to authenticated;
