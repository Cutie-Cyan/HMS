-- Repair patient ID uploads and securely associate the private document with the new patient.
begin;

alter table public.patients
  add column if not exists id_document_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('patient-id-documents', 'patient-id-documents', false, 10485760,
  array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update
set public = false,
    file_size_limit = 10485760,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Information officers upload patient ID documents" on storage.objects;
create policy "Information officers upload patient ID documents"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'patient-id-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1 from public.staff_profiles sp
    where sp.user_id = auth.uid()
      and sp.is_active = true
      and sp.role = 'info_officer'::public.staff_role
  )
);

drop policy if exists "Information officers read patient ID documents" on storage.objects;
create policy "Information officers read patient ID documents"
on storage.objects for select to authenticated
using (
  bucket_id = 'patient-id-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1 from public.staff_profiles sp
    where sp.user_id = auth.uid()
      and sp.is_active = true
      and sp.role = 'info_officer'::public.staff_role
  )
);

create or replace function public.info_officer_attach_patient_id(
  p_patient_id uuid,
  p_storage_path text
)
returns void
language plpgsql
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
    raise exception using errcode = '42501', message = 'Only an active Information Officer can attach patient ID documents.';
  end if;

  if p_storage_path is null
     or (storage.foldername(p_storage_path))[1] <> v_actor::text
     or not exists (
       select 1 from storage.objects so
       where so.bucket_id = 'patient-id-documents'
         and so.name = p_storage_path
     ) then
    raise exception using errcode = '22023', message = 'The uploaded ID document could not be verified.';
  end if;

  update public.patients
  set id_document_path = p_storage_path,
      updated_at = now()
  where id = p_patient_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'Patient record not found.';
  end if;
end;
$$;

revoke all on function public.info_officer_attach_patient_id(uuid, text) from public, anon;
grant execute on function public.info_officer_attach_patient_id(uuid, text) to authenticated;

commit;
