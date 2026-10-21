-- Keep the Patient Record list in sync when a patient is inserted.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'patients'
  ) then
    alter publication supabase_realtime add table public.patients;
  end if;
end
$$;
