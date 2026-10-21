-- Require the registered phone number in addition to patient number and date of birth
-- for public patient and billing lookups. This is an extra identity check, not OTP.
begin;

drop function if exists public.public_patient_portal_lookup(text, date);
drop function if exists public.public_patient_portal_bill_lookup(text, date, uuid);

create function public.public_patient_portal_lookup(
  p_patient_number text,
  p_date_of_birth date,
  p_phone text
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
     or p_date_of_birth is null or p_date_of_birth > current_date
     or p_phone is null
     or length(regexp_replace(p_phone, '[^0-9]', '', 'g')) < 7 then
    return;
  end if;

  return query
    select p.patient_number, p.first_name, p.middle_name, p.last_name,
           p.date_of_birth, p.sex, p.status::text, p.created_at,
           (select max(e.created_at) from public.encounters e where e.patient_id = p.id)
    from public.patients p
    where upper(p.patient_number) = upper(trim(p_patient_number))
      and p.date_of_birth = p_date_of_birth
      and regexp_replace(coalesce(p.phone, ''), '[^0-9]', '', 'g')
          = regexp_replace(p_phone, '[^0-9]', '', 'g')
    limit 1;
end;
$$;

revoke all on function public.public_patient_portal_lookup(text, date, text) from public;
grant execute on function public.public_patient_portal_lookup(text, date, text) to anon, authenticated;

create function public.public_patient_portal_bill_lookup(
  p_patient_number text,
  p_date_of_birth date,
  p_phone text,
  p_encounter_id uuid default null
)
returns table (
  patient_number text,
  patient_name text,
  encounter_id uuid,
  encounter_status text,
  bill_id uuid,
  subtotal numeric,
  discount_label text,
  discount_amount numeric,
  total_bill numeric,
  paid_at timestamptz,
  last_updated timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if nullif(trim(p_patient_number), '') is null
     or p_date_of_birth is null
     or p_phone is null
     or length(regexp_replace(p_phone, '[^0-9]', '', 'g')) < 7 then
    return;
  end if;

  return query
  select p.patient_number,
         trim(p.first_name || ' ' || coalesce(p.middle_name || ' ', '') || p.last_name),
         e.id,
         e.status,
         b.id,
         coalesce(b.subtotal, 0),
         case
           when b.discount_label is not null and b.discount_label <> 'none' then b.discount_label
           when b.discount_category = 'philhealth'::public.discount_type then 'philhealth'
           when b.discount_category = 'pwd_senior'::public.discount_type then 'pwd/senior'
           else 'none'
         end,
         coalesce(b.discount_amount, 0),
         coalesce(b.total_bill, 0),
         b.paid_at,
         greatest(coalesce(b.updated_at, e.updated_at), e.updated_at)
  from public.patients p
  join public.encounters e on e.patient_id = p.id
  left join lateral (
    select bx.*
    from public.bills bx
    where bx.encounter_id = e.id
    order by bx.is_final desc, bx.created_at desc
    limit 1
  ) b on true
  where upper(p.patient_number) = upper(trim(p_patient_number))
    and p.date_of_birth = p_date_of_birth
    and regexp_replace(coalesce(p.phone, ''), '[^0-9]', '', 'g')
        = regexp_replace(p_phone, '[^0-9]', '', 'g')
    and (p_encounter_id is null or e.id = p_encounter_id)
  order by e.created_at desc
  limit 1;
end;
$$;

revoke all on function public.public_patient_portal_bill_lookup(text, date, text, uuid) from public;
grant execute on function public.public_patient_portal_bill_lookup(text, date, text, uuid) to anon, authenticated;

commit;
