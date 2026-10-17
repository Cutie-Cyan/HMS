-- Admin-only management of room/bed configuration and ward rates.
-- These RPCs are the only client write path for administrative bed setup.
begin;

create or replace function public.admin_save_room(
  p_room_code text, p_ward_id uuid, p_is_private boolean,
  p_is_active boolean default true, p_room_id uuid default null
)
returns public.rooms
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_role public.staff_role;
  v_room public.rooms;
begin
  select sp.role into v_role from public.staff_profiles sp
  where sp.user_id = v_actor and sp.is_active = true;
  if v_actor is null or v_role is distinct from 'admin'::public.staff_role then
    raise exception using errcode = '42501', message = 'Only an active administrator can manage rooms.';
  end if;
  if nullif(trim(p_room_code), '') is null then
    raise exception using errcode = '22023', message = 'Enter a room code.';
  end if;
  if p_ward_id is not null and not exists (
    select 1 from public.wards w where w.id = p_ward_id and w.is_active = true
  ) then raise exception using errcode = '22023', message = 'Choose an active ward.'; end if;

  if p_room_id is null then
    insert into public.rooms(room_code, ward_id, is_private, is_active)
    values (trim(p_room_code), p_ward_id, p_is_private, p_is_active) returning * into v_room;
  else
    update public.rooms set room_code = trim(p_room_code), ward_id = p_ward_id,
      is_private = p_is_private, is_active = p_is_active, updated_at = now()
    where id = p_room_id returning * into v_room;
    if not found then raise exception using errcode = 'P0002', message = 'Room not found.'; end if;
  end if;

  if exists (
    select 1 from public.beds b where b.room_id = v_room.id and (
      (v_room.ward_id is not null and b.ward_id <> v_room.ward_id)
      or (b.type = 'private'::public.bed_type and not v_room.is_private)
    )
  ) then raise exception using errcode = '23514', message = 'Room settings conflict with its configured beds.'; end if;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, details)
  values (v_actor, case when p_room_id is null then 'room.created' else 'room.updated' end,
    'room', v_room.id::text, jsonb_build_object('room_code', v_room.room_code,
    'ward_id', v_room.ward_id, 'is_private', v_room.is_private, 'is_active', v_room.is_active));
  return v_room;
end;
$$;

create or replace function public.admin_save_bed(
  p_bed_code text, p_ward_id uuid, p_type public.bed_type,
  p_room_id uuid default null, p_is_active boolean default true, p_bed_id uuid default null
)
returns public.beds
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_role public.staff_role;
  v_bed public.beds;
  v_room public.rooms;
begin
  select sp.role into v_role from public.staff_profiles sp
  where sp.user_id = v_actor and sp.is_active = true;
  if v_actor is null or v_role is distinct from 'admin'::public.staff_role then
    raise exception using errcode = '42501', message = 'Only an active administrator can manage beds.';
  end if;
  if nullif(trim(p_bed_code), '') is null then
    raise exception using errcode = '22023', message = 'Enter a bed code.';
  end if;
  if not exists (select 1 from public.wards w where w.id = p_ward_id and w.is_active = true) then
    raise exception using errcode = '22023', message = 'Choose an active ward.';
  end if;

  if p_type = 'private'::public.bed_type then
    if p_room_id is null then raise exception using errcode = '22023', message = 'A private bed must belong to a configured private room.'; end if;
    select * into v_room from public.rooms r where r.id = p_room_id and r.is_active = true;
    if not found or not v_room.is_private or v_room.ward_id is distinct from p_ward_id then
      raise exception using errcode = '22023', message = 'Choose an active private room in the selected ward.';
    end if;
  elsif p_room_id is not null then
    select * into v_room from public.rooms r where r.id = p_room_id and r.is_active = true;
    if not found or (v_room.ward_id is not null and v_room.ward_id <> p_ward_id) then
      raise exception using errcode = '22023', message = 'Choose a room in the selected ward.';
    end if;
  end if;

  if p_bed_id is null then
    insert into public.beds(ward_id, room_id, bed_code, type, is_active)
    values (p_ward_id, p_room_id, trim(p_bed_code), p_type, p_is_active) returning * into v_bed;
  else
    update public.beds set ward_id = p_ward_id, room_id = p_room_id,
      bed_code = trim(p_bed_code), type = p_type, is_active = p_is_active, updated_at = now()
    where id = p_bed_id returning * into v_bed;
    if not found then raise exception using errcode = 'P0002', message = 'Bed not found.'; end if;
  end if;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, details)
  values (v_actor, case when p_bed_id is null then 'bed.created' else 'bed.updated' end,
    'bed', v_bed.id::text, jsonb_build_object('bed_code', v_bed.bed_code,
    'ward_id', v_bed.ward_id, 'room_id', v_bed.room_id, 'type', v_bed.type, 'is_active', v_bed.is_active));
  return v_bed;
end;
$$;

create or replace function public.admin_update_ward_rates(
  p_ward_id uuid, p_public_daily_rate numeric(12,2), p_private_daily_rate numeric(12,2)
)
returns public.wards
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_role public.staff_role;
  v_ward public.wards;
begin
  select sp.role into v_role from public.staff_profiles sp
  where sp.user_id = v_actor and sp.is_active = true;
  if v_actor is null or v_role is distinct from 'admin'::public.staff_role then
    raise exception using errcode = '42501', message = 'Only an active administrator can change ward rates.';
  end if;
  if p_public_daily_rate is null or p_private_daily_rate is null
    or p_public_daily_rate < 0 or p_private_daily_rate < 0 then
    raise exception using errcode = '22023', message = 'Ward rates must be zero or greater.';
  end if;
  update public.wards set public_daily_rate = p_public_daily_rate,
    private_daily_rate = p_private_daily_rate, updated_at = now()
  where id = p_ward_id and is_active = true returning * into v_ward;
  if not found then raise exception using errcode = 'P0002', message = 'Active ward not found.'; end if;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, details)
  values (v_actor, 'ward.rates_updated', 'ward', v_ward.id::text,
    jsonb_build_object('public_daily_rate', v_ward.public_daily_rate,
                       'private_daily_rate', v_ward.private_daily_rate));
  return v_ward;
end;
$$;

revoke all on function public.admin_save_room(text, uuid, boolean, boolean, uuid) from public, anon;
revoke all on function public.admin_save_bed(text, uuid, public.bed_type, uuid, boolean, uuid) from public, anon;
revoke all on function public.admin_update_ward_rates(uuid, numeric, numeric) from public, anon;
grant execute on function public.admin_save_room(text, uuid, boolean, boolean, uuid) to authenticated;
grant execute on function public.admin_save_bed(text, uuid, public.bed_type, uuid, boolean, uuid) to authenticated;
grant execute on function public.admin_update_ward_rates(uuid, numeric, numeric) to authenticated;

revoke all on function public.current_staff_role() from public, anon;
revoke all on function public.current_staff_ward_id() from public, anon;
revoke all on function public.is_active_staff() from public, anon;
grant execute on function public.current_staff_role() to authenticated;
grant execute on function public.current_staff_ward_id() to authenticated;
grant execute on function public.is_active_staff() to authenticated;

commit;
