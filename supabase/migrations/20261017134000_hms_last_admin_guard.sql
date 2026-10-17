-- Prevent administrative self-lockout and loss of the final active administrator.
create or replace function public.admin_update_staff_profile(
  p_user_id uuid,
  p_display_name text,
  p_role public.staff_role,
  p_ward_id uuid,
  p_is_active boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_before public.staff_profiles;
  v_after public.staff_profiles;
begin
  if v_actor is null or not exists (
    select 1 from public.staff_profiles sp
    where sp.user_id = v_actor and sp.is_active = true and sp.role = 'admin'::public.staff_role
  ) then
    raise exception using errcode = '42501', message = 'Only an active administrator can update staff profiles.';
  end if;

  if p_user_id is null or nullif(trim(p_display_name), '') is null or p_role is null or p_is_active is null then
    raise exception using errcode = '22023', message = 'Choose a staff account and provide valid profile details.';
  end if;
  if p_user_id = v_actor and (p_role <> 'admin'::public.staff_role or not p_is_active) then
    raise exception using errcode = '42501', message = 'You cannot deactivate yourself or remove your own administrator role.';
  end if;
  if p_role = 'nurse_station'::public.staff_role then
    if p_ward_id is null or not exists (
      select 1 from public.wards w where w.id = p_ward_id and w.is_active = true
    ) then
      raise exception using errcode = '22023', message = 'Choose an active ward for Nurse Station staff.';
    end if;
  else
    p_ward_id := null;
  end if;

  select * into v_before from public.staff_profiles where user_id = p_user_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Staff profile not found. Create or invite the Auth account first.';
  end if;

  if v_before.is_active and v_before.role = 'admin'::public.staff_role
     and (not p_is_active or p_role <> 'admin'::public.staff_role)
     and not exists (
       select 1 from public.staff_profiles sp
       where sp.user_id <> p_user_id and sp.is_active = true and sp.role = 'admin'::public.staff_role
     ) then
    raise exception using errcode = '42501', message = 'Cannot deactivate or demote the last active administrator.';
  end if;

  update public.staff_profiles
  set display_name = trim(p_display_name), role = p_role, ward_id = p_ward_id,
      is_active = p_is_active, updated_at = now()
  where user_id = p_user_id
  returning * into v_after;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, details)
  values (
    v_actor, 'staff.profile_updated', 'staff_profile', p_user_id::text,
    jsonb_build_object(
      'before', jsonb_build_object('display_name', v_before.display_name, 'role', v_before.role,
        'ward_id', v_before.ward_id, 'is_active', v_before.is_active),
      'after', jsonb_build_object('display_name', v_after.display_name, 'role', v_after.role,
        'ward_id', v_after.ward_id, 'is_active', v_after.is_active)
    )
  );
end;
$$;
revoke all on function public.admin_update_staff_profile(uuid, text, public.staff_role, uuid, boolean) from public, anon;
grant execute on function public.admin_update_staff_profile(uuid, text, public.staff_role, uuid, boolean) to authenticated;
