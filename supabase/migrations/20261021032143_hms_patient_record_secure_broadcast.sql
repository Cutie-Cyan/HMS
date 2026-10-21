-- Notify active Information Officers when a patient is registered without broadcasting patient data.
begin;

create or replace function public.broadcast_patient_registration_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.send(
    jsonb_build_object('event', 'patient_registered'),
    'patient_registered',
    'hms:patient-records',
    true
  );
  return new;
end;
$$;

revoke all on function public.broadcast_patient_registration_event() from public, anon, authenticated;

drop trigger if exists broadcast_patient_registration_event on public.patients;
create trigger broadcast_patient_registration_event
after insert on public.patients
for each row execute function public.broadcast_patient_registration_event();

drop policy if exists "Active information officers receive patient record refresh events" on realtime.messages;
create policy "Active information officers receive patient record refresh events"
on realtime.messages
for select
to authenticated
using (
  extension = 'broadcast'
  and topic = 'hms:patient-records'
  and exists (
    select 1
    from public.staff_profiles sp
    where sp.user_id = auth.uid()
      and sp.is_active = true
      and sp.role = 'info_officer'::public.staff_role
  )
);

do $$
begin
  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'patients'
  ) then
    alter publication supabase_realtime drop table public.patients;
  end if;
end
$$;

commit;
