-- Role-scoped read RPCs. Sensitive base tables stay closed to direct client reads.
begin;

create or replace function public.staff_patient_directory(p_search text default null)
returns table (
  patient_id uuid, patient_number text, first_name text, middle_name text, last_name text,
  date_of_birth date, sex text, phone text, address text, pwd_or_senior boolean,
  status public.patient_status, current_ward_id uuid, created_at timestamptz
)
language plpgsql stable security definer set search_path = ''
as $$
declare v_actor uuid := auth.uid(); v_role public.staff_role;
begin
  select sp.role into v_role from public.staff_profiles sp
  where sp.user_id = v_actor and sp.is_active = true;
  if v_actor is null or v_role is null or v_role = 'admin'::public.staff_role then
    raise exception using errcode = '42501', message = 'Active non-administrator staff access is required.';
  end if;
  return query
  select p.id, p.patient_number, p.first_name, p.middle_name, p.last_name,
    case when v_role in ('info_officer'::public.staff_role, 'emergency_nurse'::public.staff_role, 'nurse_station'::public.staff_role) then p.date_of_birth else null::date end,
    case when v_role in ('info_officer'::public.staff_role, 'emergency_nurse'::public.staff_role, 'nurse_station'::public.staff_role) then p.sex else 'unknown' end,
    case when v_role in ('info_officer'::public.staff_role, 'emergency_nurse'::public.staff_role) then p.phone else null::text end,
    case when v_role in ('info_officer'::public.staff_role, 'emergency_nurse'::public.staff_role) then p.address else null::text end,
    case when v_role in ('info_officer'::public.staff_role, 'emergency_nurse'::public.staff_role, 'cashier'::public.staff_role) then p.pwd_or_senior else false end,
    p.status, p.current_ward_id, p.created_at
  from public.patients p
  where p_search is null or p.patient_number ilike '%' || trim(p_search) || '%'
    or p.first_name ilike '%' || trim(p_search) || '%' or p.last_name ilike '%' || trim(p_search) || '%'
  order by p.created_at desc limit 100;
end;
$$;

create or replace function public.staff_encounter_queue(p_status text default null)
returns table (
  encounter_id uuid, patient_id uuid, patient_number text, patient_name text,
  doctor_id uuid, doctor_name text, findings text, recommendations text, recommendation_type text,
  encounter_status text, admitted_at timestamptz, discharged_at timestamptz, bed_id uuid,
  patient_status public.patient_status, current_ward_id uuid, created_at timestamptz
)
language plpgsql stable security definer set search_path = ''
as $$
declare v_actor uuid := auth.uid(); v_role public.staff_role; v_ward uuid;
begin
  select sp.role, sp.ward_id into v_role, v_ward from public.staff_profiles sp
  where sp.user_id = v_actor and sp.is_active = true;
  if v_actor is null or v_role not in ('emergency_nurse'::public.staff_role, 'nurse_station'::public.staff_role) then
    raise exception using errcode = '42501', message = 'Emergency Nurse or Nurse Station access is required.';
  end if;
  if p_status is not null and p_status not in ('open', 'awaiting_discharge', 'closed') then
    raise exception using errcode = '22023', message = 'Invalid encounter status filter.';
  end if;
  return query
  select e.id, p.id, p.patient_number, trim(concat_ws(' ', p.first_name, p.middle_name, p.last_name)),
    e.doctor_id, d.full_name, e.findings, e.recommendations, e.recommendation_type,
    e.status, e.admitted_at, e.discharged_at, e.bed_id, p.status, p.current_ward_id, e.created_at
  from public.encounters e join public.patients p on p.id = e.patient_id
  left join public.doctors d on d.id = e.doctor_id left join public.beds b on b.id = e.bed_id
  where (p_status is null or e.status = p_status)
    and (v_role = 'emergency_nurse'::public.staff_role or
      (v_role = 'nurse_station'::public.staff_role and (p.current_ward_id = v_ward or b.ward_id = v_ward)))
  order by e.created_at desc limit 100;
end;
$$;

create or replace function public.staff_request_queue(p_type public.request_type default null)
returns table (
  request_id uuid, patient_id uuid, patient_number text, patient_name text,
  encounter_id uuid, request_type public.request_type, request_status public.request_status,
  ward_id uuid, created_at timestamptz, paid_at timestamptz, fulfilled_at timestamptz,
  lab_result text, items jsonb
)
language plpgsql stable security definer set search_path = ''
as $$
declare v_actor uuid := auth.uid(); v_role public.staff_role; v_ward uuid;
begin
  select sp.role, sp.ward_id into v_role, v_ward from public.staff_profiles sp
  where sp.user_id = v_actor and sp.is_active = true;
  if v_actor is null or v_role not in ('emergency_nurse'::public.staff_role, 'cashier'::public.staff_role, 'pharmacy'::public.staff_role, 'lab'::public.staff_role, 'nurse_station'::public.staff_role) then
    raise exception using errcode = '42501', message = 'This role cannot access the request queue.';
  end if;
  if v_role = 'pharmacy'::public.staff_role and p_type = 'lab'::public.request_type then
    raise exception using errcode = '42501', message = 'Pharmacy cannot access laboratory requests.';
  end if;
  if v_role = 'lab'::public.staff_role and p_type = 'medicine'::public.request_type then
    raise exception using errcode = '42501', message = 'Laboratory cannot access medicine requests.';
  end if;
  return query
  select r.id, p.id, p.patient_number, trim(concat_ws(' ', p.first_name, p.middle_name, p.last_name)),
    r.encounter_id, r.type, r.status, r.ward_id, r.created_at, r.paid_at, r.fulfilled_at,
    case when v_role in ('lab'::public.staff_role, 'nurse_station'::public.staff_role, 'emergency_nurse'::public.staff_role) then r.lab_result else null::text end,
    coalesce(ri.items, '[]'::jsonb)
  from public.requests r join public.patients p on p.id = r.patient_id
  join public.encounters e on e.id = r.encounter_id
  left join lateral (
    select jsonb_agg(jsonb_build_object('id', i.id, 'inventory_item_id', i.inventory_item_id,
      'description', i.description, 'quantity', i.quantity,
      'unit_price', case when v_role = 'cashier'::public.staff_role then i.unit_price else null end)
      order by i.created_at) items from public.request_items i where i.request_id = r.id
  ) ri on true
  where (p_type is null or r.type = p_type)
    and (v_role not in ('pharmacy'::public.staff_role, 'lab'::public.staff_role) or
      r.type = case when v_role = 'pharmacy'::public.staff_role then 'medicine'::public.request_type else 'lab'::public.request_type end)
    and (v_role <> 'emergency_nurse'::public.staff_role or r.created_by = v_actor or e.created_by = v_actor)
    and (v_role <> 'nurse_station'::public.staff_role or r.ward_id = v_ward or p.current_ward_id = v_ward)
  order by r.created_at desc limit 200;
end;
$$;

create or replace function public.staff_inventory_catalog(p_department public.request_type default null)
returns table (
  item_id uuid, department public.request_type, item_name text, item_code text, unit text,
  quantity_on_hand integer, unit_price numeric, unit_cost numeric, low_stock_threshold integer,
  is_active boolean, updated_at timestamptz
)
language plpgsql stable security definer set search_path = ''
as $$
declare v_actor uuid := auth.uid(); v_role public.staff_role; v_department public.request_type;
begin
  select sp.role into v_role from public.staff_profiles sp where sp.user_id = v_actor and sp.is_active = true;
  if v_actor is null or v_role not in ('pharmacy'::public.staff_role, 'lab'::public.staff_role) then
    raise exception using errcode = '42501', message = 'Pharmacy or Laboratory access is required.';
  end if;
  v_department := case when v_role = 'pharmacy'::public.staff_role then 'medicine'::public.request_type else 'lab'::public.request_type end;
  if p_department is not null and p_department <> v_department then
    raise exception using errcode = '42501', message = 'This role cannot access another department inventory.';
  end if;
  return query select i.id, i.department, i.item_name, i.item_code, i.unit, i.quantity_on_hand,
    i.unit_price, i.unit_cost, i.low_stock_threshold, i.is_active, i.updated_at
  from public.inventory_items i where i.department = v_department order by i.item_name limit 500;
end;
$$;

create or replace function public.staff_bed_census()
returns table (
  bed_id uuid, bed_code text, bed_type public.bed_type, ward_id uuid, ward_name public.ward_name,
  room_id uuid, room_code text, is_private_room boolean, is_available boolean
)
language plpgsql stable security definer set search_path = ''
as $$
declare v_actor uuid := auth.uid();
begin
  if v_actor is null or not exists (select 1 from public.staff_profiles sp where sp.user_id = v_actor and sp.is_active = true) then
    raise exception using errcode = '42501', message = 'Active staff access is required.';
  end if;
  return query
  select b.id, b.bed_code, b.type, b.ward_id, w.name, b.room_id, r.room_code, coalesce(r.is_private, false),
    case when b.type = 'private'::public.bed_type and b.room_id is not null then not exists (
      select 1 from public.encounters e join public.beds ob on ob.id = e.bed_id
      where ob.room_id = b.room_id and e.discharged_at is null and e.status <> 'closed')
    else not exists (select 1 from public.encounters e where e.bed_id = b.id and e.discharged_at is null and e.status <> 'closed') end
  from public.beds b join public.wards w on w.id = b.ward_id left join public.rooms r on r.id = b.room_id
  where b.is_active = true and w.is_active = true order by w.name, r.room_code, b.bed_code;
end;
$$;

create or replace function public.admin_staff_directory()
returns table (user_id uuid, email text, display_name text, role public.staff_role, ward_id uuid, is_active boolean, created_at timestamptz, updated_at timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
declare v_actor uuid := auth.uid(); v_role public.staff_role;
begin
  select sp.role into v_role from public.staff_profiles sp where sp.user_id = v_actor and sp.is_active = true;
  if v_actor is null or v_role is distinct from 'admin'::public.staff_role then
    raise exception using errcode = '42501', message = 'Only an active administrator can view staff profiles.';
  end if;
  return query select sp.user_id, sp.email, sp.display_name, sp.role, sp.ward_id, sp.is_active, sp.created_at, sp.updated_at
  from public.staff_profiles sp order by sp.display_name limit 500;
end;
$$;

revoke all on function public.staff_patient_directory(text) from public, anon;
revoke all on function public.staff_encounter_queue(text) from public, anon;
revoke all on function public.staff_request_queue(public.request_type) from public, anon;
revoke all on function public.staff_inventory_catalog(public.request_type) from public, anon;
revoke all on function public.staff_bed_census() from public, anon;
revoke all on function public.admin_staff_directory() from public, anon;
grant execute on function public.staff_patient_directory(text) to authenticated;
grant execute on function public.staff_encounter_queue(text) to authenticated;
grant execute on function public.staff_request_queue(public.request_type) to authenticated;
grant execute on function public.staff_inventory_catalog(public.request_type) to authenticated;
grant execute on function public.staff_bed_census() to authenticated;
grant execute on function public.admin_staff_directory() to authenticated;

revoke all on public.patients, public.encounters, public.inventory_items, public.requests,
  public.request_items, public.bills, public.profit_inventory, public.audit_logs from anon, authenticated;
revoke all on public.staff_profiles from anon, authenticated;
grant select on public.staff_profiles to authenticated;
commit;
