-- Serialize encounter creation per patient so concurrent submissions cannot create two open encounters.
begin;

create or replace function public.emergency_nurse_save_encounter(
  p_patient_id uuid,
  p_findings text default null,
  p_recommendations text default null,
  p_recommendation_type text default null,
  p_doctor_id uuid default null,
  p_encounter_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_role public.staff_role;
  v_patient_status public.patient_status;
  v_doctor_id uuid := p_doctor_id;
  v_encounter_id uuid;
begin
  select sp.role into v_role
  from public.staff_profiles sp
  where sp.user_id = v_actor and sp.is_active = true;

  if v_actor is null or v_role is distinct from 'emergency_nurse'::public.staff_role then
    raise exception using errcode = '42501', message = 'Only an active Emergency Nurse can record doctor findings.';
  end if;

  if p_patient_id is null then
    raise exception using errcode = '22023', message = 'Choose a patient.';
  end if;
  if p_recommendation_type is not null and p_recommendation_type not in ('consult','lab','medicine','mixed') then
    raise exception using errcode = '22023', message = 'Choose Consult, Lab, Medicine, or Mixed recommendation.';
  end if;
  if p_recommendation_type is not null and nullif(trim(p_recommendations), '') is null then
    raise exception using errcode = '22023', message = 'Enter the recommendation details.';
  end if;

  -- Lock the patient before checking for an open encounter. Concurrent requests for
  -- the same patient now serialize and the later transaction sees the first encounter.
  select p.status into v_patient_status
  from public.patients p
  where p.id = p_patient_id
  for update;

  if v_patient_status is null then
    raise exception using errcode = 'P0002', message = 'Patient record not found.';
  end if;
  if v_patient_status not in ('registered'::public.patient_status, 'in_emergency'::public.patient_status) then
    raise exception using errcode = '22023', message = 'Only a newly registered or emergency patient can receive an encounter form.';
  end if;

  if v_doctor_id is not null then
    if not exists (select 1 from public.doctors d where d.id = v_doctor_id and d.is_active = true) then
      raise exception using errcode = '22023', message = 'Choose an active doctor record.';
    end if;
  else
    select d.id into v_doctor_id
    from public.doctors d
    where d.is_active = true and d.is_on_duty = true
    order by d.full_name
    limit 1;
  end if;

  if p_encounter_id is not null then
    update public.encounters
    set doctor_id = v_doctor_id,
        findings = nullif(trim(p_findings), ''),
        recommendations = nullif(trim(p_recommendations), ''),
        recommendation_type = p_recommendation_type,
        updated_at = now()
    where id = p_encounter_id
      and patient_id = p_patient_id
      and created_by = v_actor
      and status = 'open'
    returning id into v_encounter_id;

    if v_encounter_id is null then
      raise exception using errcode = '42501', message = 'That open encounter is not available for editing.';
    end if;
  else
    if exists (
      select 1 from public.encounters e
      where e.patient_id = p_patient_id and e.status = 'open'
    ) then
      raise exception using errcode = '23505', message = 'This patient already has an open encounter. Open it from the encounter queue to update the form.';
    end if;

    insert into public.encounters(
      patient_id, doctor_id, created_by, findings, recommendations, recommendation_type, status
    )
    values (
      p_patient_id, v_doctor_id, v_actor, nullif(trim(p_findings), ''),
      nullif(trim(p_recommendations), ''), p_recommendation_type, 'open'
    )
    returning id into v_encounter_id;

    update public.patients
    set status = 'in_emergency'::public.patient_status, updated_at = now()
    where id = p_patient_id and status = 'registered'::public.patient_status;
  end if;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, details)
  values (
    v_actor,
    case when p_encounter_id is null then 'encounter.created' else 'encounter.updated' end,
    'encounter',
    v_encounter_id::text,
    jsonb_build_object('patient_id', p_patient_id, 'doctor_id', v_doctor_id, 'recommendation_type', p_recommendation_type)
  );

  return v_encounter_id;
end;
$$;

revoke all on function public.emergency_nurse_save_encounter(uuid, text, text, text, uuid, uuid) from public, anon;
grant execute on function public.emergency_nurse_save_encounter(uuid, text, text, text, uuid, uuid) to authenticated;

commit;
