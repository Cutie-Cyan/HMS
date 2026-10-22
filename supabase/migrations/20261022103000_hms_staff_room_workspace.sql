-- Expose rooms for the assigned Nurse Station while preserving ward scoping.
create or replace function public.staff_room_workspace()
returns table(id uuid, room_code text, ward_id uuid, is_private boolean, is_active boolean)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_role public.staff_role;
  v_ward uuid;
begin
  select sp.role, sp.ward_id into v_role, v_ward
  from public.staff_profiles sp
  where sp.user_id = auth.uid() and sp.is_active = true;

  if auth.uid() is null or v_role is null
    or v_role not in ('admin'::public.staff_role, 'emergency_nurse'::public.staff_role, 'nurse_station'::public.staff_role)
  then
    raise exception using errcode = '42501', message = 'Ward workspace access is required.';
  end if;

  if v_role = 'nurse_station'::public.staff_role and v_ward is null then
    raise exception using errcode = '42501', message = 'An assigned ward is required for Nurse Station access.';
  end if;

  return query
  select r.id, r.room_code, r.ward_id, r.is_private, r.is_active
  from public.rooms r
  join public.wards w on w.id = r.ward_id
  where w.is_active = true
    and (v_role <> 'nurse_station'::public.staff_role or r.ward_id = v_ward)
  order by r.room_code;
end;
$function$;

revoke all on function public.staff_room_workspace() from public, anon;
grant execute on function public.staff_room_workspace() to authenticated;
