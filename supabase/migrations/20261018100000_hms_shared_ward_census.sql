-- Let staff see the shared ward census while keeping ward actions scoped.
-- Nurse Station transfer RPCs still enforce the assigned ward server-side.
create or replace function public.staff_ward_bed_workspace()
returns table(
  ward_id uuid, ward_name public.ward_name, public_daily_rate numeric,
  private_daily_rate numeric, bed_id uuid, bed_code text,
  bed_type public.bed_type, room_id uuid, room_code text, is_active boolean,
  occupied boolean, patient_id uuid, patient_number text, patient_name text,
  encounter_id uuid, admitted_at timestamptz
)
language plpgsql security definer set search_path = ''
as $$
declare v_role public.staff_role;
begin
  select sp.role into v_role
  from public.staff_profiles sp
  where sp.user_id = auth.uid() and sp.is_active = true;

  if auth.uid() is null or v_role is null
    or v_role not in ('admin'::public.staff_role, 'emergency_nurse'::public.staff_role, 'nurse_station'::public.staff_role)
  then
    raise exception using errcode = '42501', message = 'Ward workspace access is required.';
  end if;

  return query
  select w.id, w.name, w.public_daily_rate, w.private_daily_rate,
    b.id, b.bed_code, b.type, b.room_id, r.room_code, b.is_active,
    (e.id is not null or (
      b.type = 'private'::public.bed_type and exists (
        select 1 from public.encounters en
        join public.beds occupied_bed on occupied_bed.id = en.bed_id
        where occupied_bed.room_id = b.room_id and en.status <> 'closed'
      )
    )),
    p.id, p.patient_number,
    case when p.id is null then null else trim(concat_ws(' ', p.first_name, p.middle_name, p.last_name)) end,
    e.id, e.admitted_at
  from public.wards w
  left join public.beds b on b.ward_id = w.id and b.is_active = true
  left join public.rooms r on r.id = b.room_id
  left join lateral (
    select en.id, en.patient_id, en.admitted_at
    from public.encounters en
    where en.bed_id = b.id and en.status <> 'closed'
    order by en.created_at desc limit 1
  ) e on true
  left join public.patients p on p.id = e.patient_id
  where w.is_active = true
  order by w.name, b.bed_code;
end;
$$;

revoke all on function public.staff_ward_bed_workspace() from public, anon;
grant execute on function public.staff_ward_bed_workspace() to authenticated;
