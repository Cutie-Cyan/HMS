-- Allow administrators as well as Information Officers to maintain doctor records.
-- The admin module exposes this form, so the RPC must authorize the same role.
begin;

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

  if v_actor is null or v_role not in ('admin'::public.staff_role, 'info_officer'::public.staff_role) then
    raise exception using errcode = '42501', message = 'Only an active administrator or Information Officer can manage doctor records.';
  end if;

  if nullif(trim(p_full_name), '') is null then
    raise exception using errcode = '22023', message = 'Enter the doctor name.';
  end if;

  if p_fixed_fee is null or p_fixed_fee < 0 then
    raise exception using errcode = '22023', message = 'Doctor fee must be zero or greater.';
  end if;

  if p_doctor_id is null then
    insert into public.doctors(full_name, specialty, is_on_duty, fixed_fee, is_active, created_by)
    values (trim(p_full_name), nullif(trim(p_specialty), ''), coalesce(p_is_on_duty, false), p_fixed_fee, true, v_actor)
    returning id into v_doctor_id;

    insert into public.audit_logs(actor_id, action, entity_type, entity_id, details)
    values (v_actor, 'doctor.created', 'doctor', v_doctor_id::text,
      jsonb_build_object('full_name', trim(p_full_name), 'is_on_duty', coalesce(p_is_on_duty, false)));
  else
    update public.doctors
    set full_name = trim(p_full_name),
        specialty = nullif(trim(p_specialty), ''),
        is_on_duty = coalesce(p_is_on_duty, false),
        fixed_fee = p_fixed_fee,
        updated_at = now()
    where id = p_doctor_id and is_active = true
    returning id into v_doctor_id;

    if v_doctor_id is null then
      raise exception using errcode = 'P0002', message = 'That active doctor record could not be found.';
    end if;

    insert into public.audit_logs(actor_id, action, entity_type, entity_id, details)
    values (v_actor, 'doctor.updated', 'doctor', v_doctor_id::text,
      jsonb_build_object('full_name', trim(p_full_name), 'is_on_duty', coalesce(p_is_on_duty, false)));
  end if;

  return v_doctor_id;
end;
$$;

revoke all on function public.info_officer_save_doctor(text, text, boolean, numeric, uuid) from public, anon;
grant execute on function public.info_officer_save_doctor(text, text, boolean, numeric, uuid) to authenticated;

commit;
