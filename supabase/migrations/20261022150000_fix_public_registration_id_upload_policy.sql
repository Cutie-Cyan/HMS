-- storage.foldername() excludes the file name, so "pending/<uuid>.jpg" has depth 1.
-- The previous policy required depth 2, which rejected every public ID upload.
begin;

drop policy if exists "Public can upload registration ID documents" on storage.objects;
create policy "Public can upload registration ID documents" on storage.objects
for insert to anon, authenticated
with check (
  bucket_id = 'patient-id-documents'
  and (storage.foldername(name))[1] = 'pending'
  and array_length(storage.foldername(name), 1) = 1
);

commit;
