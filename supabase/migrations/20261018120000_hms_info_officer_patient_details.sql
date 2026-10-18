-- Allow Information Officers to correct patient date of birth and address only.
begin;

create or replace function public.info_officer_update_patient_details(
  p_patient_id uuid,
  p_date_of_birth date,
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

  if p_address is not null and length(trim(p_address)) > 500 then
    raise exception using errcode = '22023',
      message = 'Patient address must be 500 characters or fewer.';
  end if;

  select * into v_before
  from public.patients
  where id = p_patient_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Patient record not found.';
  end if;

  update public.patients
  set date_of_birth = p_date_of_birth,
      address = nullif(trim(p_address), ''),
      updated_at = now()
  where id = p_patient_id
  returning * into v_after;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, details)
  values (
    v_actor, 'patient.details_updated', 'patient', p_patient_id::text,
    jsonb_build_object(
      'patient_number', v_after.patient_number,
      'before', jsonb_build_object('date_of_birth', v_before.date_of_birth, 'address', v_before.address),
      'after', jsonb_build_object('date_of_birth', v_after.date_of_birth, 'address', v_after.address)
    )
  );
end;
$$;

revoke all on function public.info_officer_update_patient_details(uuid, date, text) from public, anon;
grant execute on function public.info_officer_update_patient_details(uuid, date, text) to authenticated;

commit;