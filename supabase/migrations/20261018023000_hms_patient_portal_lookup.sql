-- Public patient portal: verify patient number + DOB and return only a limited registration summary.
begin;

create or replace function public.public_patient_portal_lookup(
  p_patient_number text,
  p_date_of_birth date
)
returns table (
  patient_number text,
  first_name text,
  middle_name text,
  last_name text,
  date_of_birth date,
  sex text,
  status text,
  created_at timestamptz,
  last_visit_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_patient_number is null or length(trim(p_patient_number)) < 5
     or p_date_of_birth is null or p_date_of_birth > current_date then
    return;
  end if;
  return query
    select p.patient_number, p.first_name, p.middle_name, p.last_name,
           p.date_of_birth, p.sex, p.status::text, p.created_at,
           (select max(e.created_at) from public.encounters e where e.patient_id = p.id)
    from public.patients p
    where upper(p.patient_number) = upper(trim(p_patient_number))
      and p.date_of_birth = p_date_of_birth
    limit 1;
end;
$$;

revoke all on function public.public_patient_portal_lookup(text, date) from public;
grant execute on function public.public_patient_portal_lookup(text, date) to anon, authenticated;

commit;
