-- Align patient demographics and doctor catalog permissions with the agreed role workflow.
begin;

create or replace function public.info_officer_update_patient_details(
  p_patient_id uuid,
  p_date_of_birth date,
  p_phone text,
  p_address text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_role public.staff_role;
  v_before public.patients%rowtype;
  v_after public.patients%rowtype;
begin
  select sp.role into v_role
  from public.staff_profiles sp
  where sp.user_id = v_actor and sp.is_active = true;

  if v_actor is null or v_role is distinct from 'info_officer'::public.staff_role then
    raise exception using errcode = '42501',
      message = 'Only an active Information Officer can update patient details.';
  end if;

  if p_patient_id is null or p_date_of_birth is null or p_date_of_birth > current_date then
    raise exception using errcode = '22023',
      message = 'Choose a patient and enter a valid date of birth.';
  end if;

  if p_phone is not null and length(trim(p_phone)) > 40 then
    raise exception using errcode = '22023', message = 'Patient phone must be 40 characters or fewer.';
  end if;
  if p_address is not null and length(trim(p_address)) > 500 then
    raise exception using errcode = '22023', message = 'Patient address must be 500 characters or fewer.';
  end if;

  select * into v_before from public.patients where id = p_patient_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Patient record not found.';
  end if;

  update public.patients
  set date_of_birth = p_date_of_birth,
      phone = nullif(trim(p_phone), ''),
      address = nullif(trim(p_address), ''),
      updated_at = now()
  where id = p_patient_id
  returning * into v_after;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, details)
  values (
    v_actor, 'patient.details_updated', 'patient', p_patient_id::text,
    jsonb_build_object(
      'patient_number', v_after.patient_number,
      'before', jsonb_build_object('date_of_birth', v_before.date_of_birth, 'phone', v_before.phone, 'address', v_before.address),
      'after', jsonb_build_object('date_of_birth', v_after.date_of_birth, 'phone', v_after.phone, 'address', v_after.address)
    )
  );
end;
$$;

revoke all on function public.info_officer_update_patient_details(uuid, date, text) from public, anon;
revoke all on function public.info_officer_update_patient_details(uuid, date, text, text) from public, anon;
grant execute on function public.info_officer_update_patient_details(uuid, date, text, text) to authenticated;

create or replace function public.info_officer_save_doctor(
  p_full_name text,
  p_specialty text default null,
  p_is_on_duty boolean default false,
  p_fixed_fee numeric default 0,
  p_doctor_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_role public.staff_role;
  v_doctor_id uuid;
begin
  select sp.role into v_role
  from public.staff_profiles sp
  where sp.user_id = v_actor and sp.is_active = true;

  if v_actor is null or v_role is distinct from 'admin'::public.staff_role then
    raise exception using errcode = '42501', message = 'Only an active administrator can manage doctor records.';
  end if;
  if nullif(trim(p_full_name), '') is null then
    raise exception using errcode = '22023', message = 'Enter the doctor name.';
  end if;
  if p_fixed_fee is null or p_fixed_fee < 0 then
    raise exception using errcode = '22023', message = 'Doctor fee must be zero or greater.';
  end if;

  if p_doctor_id is null then
    insert into public.doctors(full_name, specialty, is_on_duty, fixed_fee, is_active, created_by)
    values(trim(p_full_name), nullif(trim(p_specialty), ''), coalesce(p_is_on_duty, false), p_fixed_fee, true, v_actor)
    returning id into v_doctor_id;
    insert into public.audit_logs(actor_id, action, entity_type, entity_id, details)
    values(v_actor, 'doctor.created', 'doctor', v_doctor_id::text,
      jsonb_build_object('full_name', trim(p_full_name), 'is_on_duty', coalesce(p_is_on_duty, false)));
  else
    update public.doctors
    set full_name = trim(p_full_name), specialty = nullif(trim(p_specialty), ''),
        is_on_duty = coalesce(p_is_on_duty, false), fixed_fee = p_fixed_fee, updated_at = now()
    where id = p_doctor_id and is_active = true
    returning id into v_doctor_id;
    if v_doctor_id is null then
      raise exception using errcode = 'P0002', message = 'That active doctor record could not be found.';
    end if;
    insert into public.audit_logs(actor_id, action, entity_type, entity_id, details)
    values(v_actor, 'doctor.updated', 'doctor', v_doctor_id::text,
      jsonb_build_object('full_name', trim(p_full_name), 'is_on_duty', coalesce(p_is_on_duty, false)));
  end if;
  return v_doctor_id;
end;
$$;

revoke all on function public.info_officer_save_doctor(text, text, boolean, numeric, uuid) from public, anon;
grant execute on function public.info_officer_save_doctor(text, text, boolean, numeric, uuid) to authenticated;

commit;
