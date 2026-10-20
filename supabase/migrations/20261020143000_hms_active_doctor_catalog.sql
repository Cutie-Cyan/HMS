-- Return the active doctor catalog to authenticated staff through a role-checked
-- SECURITY DEFINER function so the list matches successful doctor creation.
begin;

create or replace function public.staff_active_doctors()
returns table (
  id uuid,
  full_name text,
  specialty text,
  is_on_duty boolean,
  fixed_fee numeric,
  is_active boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_role public.staff_role;
begin
  select sp.role into v_role
  from public.staff_profiles sp
  where sp.user_id = v_actor and sp.is_active = true;

  if v_actor is null or v_role not in (
    'admin'::public.staff_role,
    'info_officer'::public.staff_role,
    'emergency_nurse'::public.staff_role
  ) then
    raise exception using errcode = '42501', message = 'You are not allowed to view doctor records.';
  end if;

  return query
  select d.id, d.full_name, d.specialty, d.is_on_duty, d.fixed_fee, d.is_active
  from public.doctors d
  where d.is_active = true
  order by d.full_name;
end;
$$;

revoke all on function public.staff_active_doctors() from public, anon;
grant execute on function public.staff_active_doctors() to authenticated;

commit;
