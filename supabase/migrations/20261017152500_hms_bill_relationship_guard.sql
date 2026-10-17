-- Keep billing ownership consistent with the clinical encounter and optional request.
-- A foreign key alone cannot ensure that related rows reference the same patient.
begin;

create or replace function public.enforce_hms_bill_relationships()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_encounter_patient uuid;
  v_request_patient uuid;
  v_request_encounter uuid;
begin
  select e.patient_id
    into v_encounter_patient
  from public.encounters e
  where e.id = new.encounter_id;

  if v_encounter_patient is null then
    raise exception using errcode = '23503',
      message = 'Bill must reference an existing encounter.';
  end if;

  if new.patient_id is distinct from v_encounter_patient then
    raise exception using errcode = '23514',
      message = 'Bill patient must match the encounter patient.';
  end if;

  if new.request_id is not null then
    select r.patient_id, r.encounter_id
      into v_request_patient, v_request_encounter
    from public.requests r
    where r.id = new.request_id;

    if not found then
      raise exception using errcode = '23503',
        message = 'Request bill must reference an existing request.';
    end if;

    if v_request_patient is distinct from new.patient_id
       or v_request_encounter is distinct from new.encounter_id then
      raise exception using errcode = '23514',
        message = 'Request bill patient and encounter must match the request.';
    end if;

    if new.is_final then
      raise exception using errcode = '23514',
        message = 'A request bill cannot be marked as a final inpatient bill.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists bills_relationship_guard on public.bills;
create trigger bills_relationship_guard
before insert or update of patient_id, encounter_id, request_id, is_final
on public.bills
for each row execute function public.enforce_hms_bill_relationships();

revoke all on function public.enforce_hms_bill_relationships() from public, anon, authenticated;

commit;
