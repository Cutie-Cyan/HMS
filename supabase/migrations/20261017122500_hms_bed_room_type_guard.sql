-- Defense in depth: a private room cannot contain a public bed.
create or replace function public.guard_bed_room_type()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_room public.rooms%rowtype;
begin
 if new.room_id is null then
   if new.type='private'::public.bed_type then raise exception using errcode='23514',message='A private bed must belong to a private room.'; end if;
   return new;
 end if;
 select * into v_room from public.rooms where id=new.room_id;
 if not found then raise exception using errcode='23503',message='The selected room does not exist.'; end if;
 if v_room.ward_id is not null and v_room.ward_id is distinct from new.ward_id then raise exception using errcode='23514',message='The bed and room must belong to the same ward.'; end if;
 if new.type='private'::public.bed_type and not v_room.is_private then raise exception using errcode='23514',message='A private bed must belong to a private room.'; end if;
 if new.type='public'::public.bed_type and v_room.is_private then raise exception using errcode='23514',message='A private room cannot contain a public bed.'; end if;
 return new;
end; $$;
revoke all on function public.guard_bed_room_type() from public,anon;
drop trigger if exists beds_guard_room_type on public.beds;
create trigger beds_guard_room_type before insert or update of room_id,ward_id,type on public.beds for each row execute function public.guard_bed_room_type();
