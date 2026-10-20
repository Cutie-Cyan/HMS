-- Allow active administrators to read the active doctor catalog as well as
-- Information Officers and Emergency Nurses. The UI reads the table directly.
begin;

drop policy if exists doctors_read_info_officer_or_nurse on public.doctors;

create policy doctors_read_admin_info_officer_or_nurse
on public.doctors
for select
to authenticated
using (
  public.current_staff_role() = any (
    array[
      'admin'::public.staff_role,
      'info_officer'::public.staff_role,
      'emergency_nurse'::public.staff_role
    ]
  )
);

commit;
