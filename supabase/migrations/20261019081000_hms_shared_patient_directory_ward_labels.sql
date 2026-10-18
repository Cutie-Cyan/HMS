-- Share the patient directory across all wards while retaining role-based field privacy.
drop function if exists public.staff_patient_directory(text);

create function public.staff_patient_directory(p_search text default null)
returns table (
  patient_id uuid, patient_number text, first_name text, middle_name text, last_name text,
  date_of_birth date, sex text, phone text, address text, pwd_or_senior boolean,
  status public.patient_status, current_ward_id uuid, current_ward_name text, created_at timestamptz
)
language plpgsql stable security definer set search_path = ''
as $function$
declare v_actor uuid := auth.uid(); v_role public.staff_role;
begin
  select sp.role into v_role from public.staff_profiles sp
  where sp.user_id = v_actor and sp.is_active = true;

  if v_actor is null or v_role is null
    or v_role not in ('info_officer'::public.staff_role, 'emergency_nurse'::public.staff_role,
      'nurse_station'::public.staff_role, 'cashier'::public.staff_role,
      'pharmacy'::public.staff_role, 'lab'::public.staff_role)
  then
    raise exception using errcode = '42501', message = 'Active staff access is required to view the patient directory.';
  end if;

  return query
  select p.id, p.patient_number, p.first_name, p.middle_name, p.last_name,
    case when v_role in ('info_officer'::public.staff_role, 'emergency_nurse'::public.staff_role, 'nurse_station'::public.staff_role) then p.date_of_birth else null::date end,
    case when v_role in ('info_officer'::public.staff_role, 'emergency_nurse'::public.staff_role, 'nurse_station'::public.staff_role) then p.sex else 'unknown' end,
    case when v_role in ('info_officer'::public.staff_role, 'emergency_nurse'::public.staff_role, 'nurse_station'::public.staff_role) then p.phone else null::text end,
    case when v_role in ('info_officer'::public.staff_role, 'emergency_nurse'::public.staff_role, 'nurse_station'::public.staff_role) then p.address else null::text end,
    case when v_role in ('info_officer'::public.staff_role, 'emergency_nurse'::public.staff_role, 'nurse_station'::public.staff_role, 'cashier'::public.staff_role) then p.pwd_or_senior else false end,
    p.status, p.current_ward_id, w.name::text, p.created_at
  from public.patients p
  left join public.wards w on w.id = p.current_ward_id
  where p_search is null or p.patient_number ilike '%' || trim(p_search) || '%'
    or p.first_name ilike '%' || trim(p_search) || '%'
    or p.last_name ilike '%' || trim(p_search) || '%'
  order by p.created_at desc limit 100;
end;
$function$;

revoke all on function public.staff_patient_directory(text) from public, anon;
grant execute on function public.staff_patient_directory(text) to authenticated;
