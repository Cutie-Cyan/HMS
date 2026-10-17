-- Step 8: ward-scoped bed board and guarded admission / in-ward transfer.
create or replace function public.staff_ward_bed_workspace()
returns table(ward_id uuid, ward_name public.ward_name, public_daily_rate numeric, private_daily_rate numeric, bed_id uuid, bed_code text, bed_type public.bed_type, room_id uuid, room_code text, is_active boolean, occupied boolean, patient_id uuid, patient_number text, patient_name text, encounter_id uuid, admitted_at timestamptz)
language plpgsql security definer set search_path=''
as $$
declare v_role public.staff_role; v_ward uuid;
begin
 select sp.role,sp.ward_id into v_role,v_ward from public.staff_profiles sp where sp.user_id=auth.uid() and sp.is_active=true;
 if auth.uid() is null or v_role is null or v_role not in ('admin','emergency_nurse','nurse_station') then raise exception using errcode='42501',message='Ward workspace access is required.'; end if;
 return query
 select w.id,w.name,w.public_daily_rate,w.private_daily_rate,b.id,b.bed_code,b.type,b.room_id,r.room_code,b.is_active,
  (e.id is not null or (b.type='private'::public.bed_type and exists(select 1 from public.encounters en join public.beds occupied_bed on occupied_bed.id=en.bed_id where occupied_bed.room_id=b.room_id and en.status<>'closed'))),
  p.id,p.patient_number,case when p.id is null then null else trim(concat_ws(' ',p.first_name,p.middle_name,p.last_name)) end,e.id,e.admitted_at
 from public.wards w left join public.beds b on b.ward_id=w.id and b.is_active=true
 left join public.rooms r on r.id=b.room_id
 left join lateral (select en.id,en.patient_id,en.admitted_at from public.encounters en where en.bed_id=b.id and en.status<>'closed' order by en.created_at desc limit 1) e on true
 left join public.patients p on p.id=e.patient_id
 where w.is_active=true and (v_role<>'nurse_station' or w.id=v_ward)
 order by w.name,b.bed_code;
end; $$;
revoke all on function public.staff_ward_bed_workspace() from public,anon;
grant execute on function public.staff_ward_bed_workspace() to authenticated;

create or replace function public.emergency_nurse_admit_patient(p_encounter_id uuid,p_bed_id uuid)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=auth.uid(); v_role public.staff_role; v_enc public.encounters%rowtype; v_patient public.patients%rowtype; v_bed public.beds%rowtype; v_room public.rooms%rowtype;
begin
 select sp.role into v_role from public.staff_profiles sp where sp.user_id=v_actor and sp.is_active=true;
 if v_actor is null or v_role is distinct from 'emergency_nurse'::public.staff_role then raise exception using errcode='42501',message='Only an active Emergency Nurse can admit a patient.'; end if;
 select * into v_enc from public.encounters where id=p_encounter_id for update;
 if not found or v_enc.status<>'open' then raise exception using errcode='P0002',message='An open encounter is required for admission.'; end if;
 select * into v_patient from public.patients where id=v_enc.patient_id for update;
 if v_patient.status='discharged' then raise exception using errcode='22023',message='A discharged patient cannot be admitted from this encounter.'; end if;
 select * into v_bed from public.beds where id=p_bed_id and is_active=true for update;
 if not found then raise exception using errcode='22023',message='Choose an active bed.'; end if;
 if not exists(select 1 from public.wards where id=v_bed.ward_id and is_active=true) then raise exception using errcode='22023',message='Choose a bed in an active ward.'; end if;
 if exists(select 1 from public.encounters where bed_id=p_bed_id and status<>'closed' and id<>p_encounter_id) then raise exception using errcode='23505',message='That bed is already occupied.'; end if;
 if v_bed.type='private' then
  select * into v_room from public.rooms where id=v_bed.room_id and is_active=true for update;
  if not found or not v_room.is_private then raise exception using errcode='22023',message='A private bed must be in an active private room.'; end if;
  if exists(select 1 from public.encounters en join public.beds b on b.id=en.bed_id where b.room_id=v_bed.room_id and en.status<>'closed' and en.id<>p_encounter_id) then raise exception using errcode='23505',message='The private room is already occupied.'; end if;
 end if;
 update public.encounters set bed_id=p_bed_id,admitted_at=coalesce(admitted_at,now()),updated_at=now() where id=p_encounter_id;
 update public.patients set status='admitted',current_ward_id=v_bed.ward_id,updated_at=now() where id=v_patient.id;
 insert into public.audit_logs(actor_id,action,entity_type,entity_id,details) values(v_actor,'patient.admitted','encounter',p_encounter_id::text,jsonb_build_object('patient_id',v_patient.id,'ward_id',v_bed.ward_id,'bed_id',v_bed.id,'bed_type',v_bed.type));
 return p_encounter_id;
end; $$;
revoke all on function public.emergency_nurse_admit_patient(uuid,uuid) from public,anon;
grant execute on function public.emergency_nurse_admit_patient(uuid,uuid) to authenticated;

create or replace function public.nurse_station_transfer_patient(p_encounter_id uuid,p_bed_id uuid)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=auth.uid(); v_role public.staff_role; v_ward uuid; v_enc public.encounters%rowtype; v_bed public.beds%rowtype; v_patient public.patients%rowtype; v_room public.rooms%rowtype;
begin
 select sp.role,sp.ward_id into v_role,v_ward from public.staff_profiles sp where sp.user_id=v_actor and sp.is_active=true;
 if v_actor is null or v_role is distinct from 'nurse_station'::public.staff_role or v_ward is null then raise exception using errcode='42501',message='An assigned Nurse Station account is required.'; end if;
 select * into v_enc from public.encounters where id=p_encounter_id for update;
 if not found or v_enc.status='closed' or v_enc.bed_id is null then raise exception using errcode='P0002',message='An active admitted encounter is required.'; end if;
 select * into v_patient from public.patients where id=v_enc.patient_id for update;
 if v_patient.current_ward_id is distinct from v_ward then raise exception using errcode='42501',message='You can only manage patients assigned to your ward.'; end if;
 select * into v_bed from public.beds where id=p_bed_id and is_active=true and ward_id=v_ward for update;
 if not found then raise exception using errcode='22023',message='Choose an active bed in your assigned ward.'; end if;
 if exists(select 1 from public.encounters where bed_id=p_bed_id and status<>'closed' and id<>p_encounter_id) then raise exception using errcode='23505',message='That bed is already occupied.'; end if;
 if v_bed.type='private' then
  select * into v_room from public.rooms where id=v_bed.room_id and is_active=true for update;
  if not found or not v_room.is_private then raise exception using errcode='22023',message='A private bed must be in an active private room.'; end if;
  if exists(select 1 from public.encounters en join public.beds b on b.id=en.bed_id where b.room_id=v_bed.room_id and en.status<>'closed' and en.id<>p_encounter_id) then raise exception using errcode='23505',message='The private room is already occupied.'; end if;
 end if;
 update public.encounters set bed_id=p_bed_id,updated_at=now() where id=p_encounter_id;
 insert into public.audit_logs(actor_id,action,entity_type,entity_id,details) values(v_actor,'patient.bed_transferred','encounter',p_encounter_id::text,jsonb_build_object('patient_id',v_patient.id,'ward_id',v_ward,'from_bed_id',v_enc.bed_id,'to_bed_id',v_bed.id));
 return p_encounter_id;
end; $$;
revoke all on function public.nurse_station_transfer_patient(uuid,uuid) from public,anon;
grant execute on function public.nurse_station_transfer_patient(uuid,uuid) to authenticated;
