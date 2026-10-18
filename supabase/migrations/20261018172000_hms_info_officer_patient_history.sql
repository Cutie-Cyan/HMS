-- Give Information Officers read-only access to a patient's encounter history for records and printouts.
begin;

create or replace function public.info_officer_patient_history(p_patient_id uuid)
returns table (
  encounter_id uuid,
  doctor_name text,
  findings text,
  recommendations text,
  recommendation_type text,
  encounter_status text,
  admitted_at timestamptz,
  discharged_at timestamptz,
  created_at timestamptz
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

  if v_actor is null or v_role is distinct from 'info_officer'::public.staff_role then
    raise exception using errcode = '42501',
      message = 'Only an active Information Officer can view patient history.';
  end if;

  if p_patient_id is null or not exists (select 1 from public.patients p where p.id = p_patient_id) then
    raise exception using errcode = 'P0002', message = 'Patient record not found.';
  end if;

  return query
  select e.id, d.full_name, e.findings, e.recommendations,
    e.recommendation_type, e.status::text, e.admitted_at, e.discharged_at, e.created_at
  from public.encounters e
  left join public.doctors d on d.id = e.doctor_id
  where e.patient_id = p_patient_id
  order by e.created_at desc
  limit 100;
end;
$$;

revoke all on function public.info_officer_patient_history(uuid) from public, anon;
grant execute on function public.info_officer_patient_history(uuid) to authenticated;

commit;
