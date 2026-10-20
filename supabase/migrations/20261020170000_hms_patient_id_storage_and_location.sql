-- Secure ID document uploads and expose a patient's current room/bed to Information Officers.
begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('patient-id-documents', 'patient-id-documents', false, 10485760,
  array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 10485760,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Information officers upload patient ID documents"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'patient-id-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1 from public.staff_profiles sp
    where sp.user_id = auth.uid() and sp.is_active = true
      and sp.role = 'info_officer'::public.staff_role
  )
);

create policy "Information officers read patient ID documents"
on storage.objects for select to authenticated
using (
  bucket_id = 'patient-id-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1 from public.staff_profiles sp
    where sp.user_id = auth.uid() and sp.is_active = true
      and sp.role = 'info_officer'::public.staff_role
  )
);

create or replace function public.info_officer_patient_location(p_patient_id uuid)
returns table (ward_name text, room_code text, bed_code text)
language plpgsql stable security definer set search_path = ''
as $$
declare v_role public.staff_role;
begin
  select sp.role into v_role from public.staff_profiles sp
  where sp.user_id = auth.uid() and sp.is_active = true;
  if auth.uid() is null or v_role is distinct from 'info_officer'::public.staff_role then
    raise exception using errcode = '42501', message = 'Only an active Information Officer can view patient location.';
  end if;
  return query
  select w.name::text, r.room_code::text, b.bed_code::text
  from public.encounters e
  left join public.beds b on b.id = e.bed_id
  left join public.rooms r on r.id = b.room_id
  left join public.wards w on w.id = b.ward_id
  where e.patient_id = p_patient_id and e.status <> 'closed'
  order by e.created_at desc
  limit 1;
end;
$$;
revoke all on function public.info_officer_patient_location(uuid) from public, anon;
grant execute on function public.info_officer_patient_location(uuid) to authenticated;

commit;
