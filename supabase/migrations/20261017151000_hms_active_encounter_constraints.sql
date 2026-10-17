-- Defense in depth for encounter creation and bed assignment.
-- The RPC locks serialize normal workflows; these indexes protect invariants
-- even if a future function forgets to perform the corresponding check.
begin;

-- A patient can have only one encounter that is still open or awaiting discharge.
create unique index if not exists encounters_one_active_per_patient
  on public.encounters(patient_id)
  where status in ('open', 'awaiting_discharge');

-- A bed can belong to only one non-closed encounter at a time.
create unique index if not exists encounters_one_active_per_bed
  on public.encounters(bed_id)
  where bed_id is not null and status in ('open', 'awaiting_discharge');

commit;
