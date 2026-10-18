-- Public QR registration collects submissions for Information Officer review.
-- Public users can submit only intake fields; they cannot read or approve records.
begin;

create table if not exists public.patient_registration_submissions (
  id uuid primary key default gen_random_uuid(),
  first_name text not null check (length(trim(first_name)) between 1 and 100),
  middle_name text check (middle_name is null or length(middle_name) <= 100),
  last_name text not null check (length(trim(last_name)) between 1 and 100),
  date_of_birth date not null,
  sex text not null check (sex in ('female','male','other','unknown')),
  phone text check (phone is null or length(phone) <= 40),
  address text check (address is null or length(address) <= 500),
  pwd_or_senior boolean not null default false,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  patient_id uuid references public.patients(id) on delete restrict,
  constraint reviewed_submission_has_timestamp check (
    (status = 'pending' and reviewed_at is null and reviewed_by is null and patient_id is null)
    or (status = 'rejected' and reviewed_at is not null and reviewed_by is not null and patient_id is null)
    or (status = 'approved' and reviewed_at is not null and reviewed_by is not null and patient_id is not null)
  )
);

create index if not exists patient_registration_submissions_queue_idx
  on public.patient_registration_submissions(status, created_at);

alter table public.patient_registration_submissions enable row level security;
revoke all on public.patient_registration_submissions from public, anon, authenticated;
grant insert (first_name, middle_name, last_name, date_of_birth, sex, phone, address, pwd_or_senior)
  on public.patient_registration_submissions to anon, authenticated;

create policy public_submit_patient_registration on public.patient_registration_submissions
  for insert to anon, authenticated
  with check (
    status = 'pending'
    and reviewed_at is null and reviewed_by is null and patient_id is null
    and date_of_birth <= current_date
    and length(trim(first_name)) between 1 and 100
    and length(trim(last_name)) between 1 and 100
    and sex in ('female','male','other','unknown')
  );

create or replace function public.info_officer_pending_patient_submissions()
returns table (
  submission_id uuid,
  first_name text,
  middle_name text,
  last_name text,
  date_of_birth date,
  sex text,
  phone text,
  address text,
  pwd_or_senior boolean,
  submitted_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare v_actor uuid := auth.uid(); v_role public.staff_role;
begin
  select sp.role into v_role from public.staff_profiles sp
  where sp.user_id = v_actor and sp.is_active = true;
  if v_actor is null or v_role is distinct from 'info_officer'::public.staff_role then
    raise exception using errcode = '42501', message = 'Only an active Information Officer can review patient submissions.';
  end if;
  return query
    select s.id, s.first_name, s.middle_name, s.last_name, s.date_of_birth,
           s.sex, s.phone, s.address, s.pwd_or_senior, s.created_at
    from public.patient_registration_submissions s
    where s.status = 'pending'
    order by s.created_at asc;
end;
$$;

create or replace function public.info_officer_review_patient_submission(
  p_submission_id uuid,
  p_approve boolean
)
returns table (submission_id uuid, submission_status text, patient_id uuid, patient_number text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_role public.staff_role;
  v_submission public.patient_registration_submissions%rowtype;
  v_patient_id uuid;
  v_patient_number text;
  v_status text;
begin
  select sp.role into v_role from public.staff_profiles sp
  where sp.user_id = v_actor and sp.is_active = true;
  if v_actor is null or v_role is distinct from 'info_officer'::public.staff_role then
    raise exception using errcode = '42501', message = 'Only an active Information Officer can review patient submissions.';
  end if;

  select s.* into v_submission
  from public.patient_registration_submissions s
  where s.id = p_submission_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Patient submission was not found.';
  end if;
  if v_submission.status <> 'pending' then
    raise exception using errcode = '22023', message = 'This patient submission has already been reviewed.';
  end if;

  if p_approve then
    v_patient_number := 'HMS-' || to_char(current_date, 'YYYYMMDD') || '-' ||
      lpad(nextval('public.hms_patient_number_seq')::text, 6, '0');
    insert into public.patients (
      patient_number, first_name, middle_name, last_name, date_of_birth, sex,
      phone, address, pwd_or_senior, status, created_by
    ) values (
      v_patient_number, trim(v_submission.first_name), nullif(trim(v_submission.middle_name), ''),
      trim(v_submission.last_name), v_submission.date_of_birth, v_submission.sex,
      nullif(trim(v_submission.phone), ''), nullif(trim(v_submission.address), ''),
      v_submission.pwd_or_senior, 'registered'::public.patient_status, v_actor
    ) returning id into v_patient_id;
    v_status := 'approved';
    update public.patient_registration_submissions
      set status = v_status, reviewed_at = now(), reviewed_by = v_actor, patient_id = v_patient_id
      where id = p_submission_id;
    insert into public.audit_logs(actor_id, action, entity_type, entity_id, details)
      values (v_actor, 'patient.registered_from_qr', 'patient', v_patient_id::text,
        jsonb_build_object('patient_number', v_patient_number, 'submission_id', p_submission_id));
  else
    v_status := 'rejected';
    update public.patient_registration_submissions
      set status = v_status, reviewed_at = now(), reviewed_by = v_actor
      where id = p_submission_id;
  end if;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, details)
    values (v_actor, 'patient.registration_submission_reviewed', 'patient_registration_submission',
      p_submission_id::text, jsonb_build_object('status', v_status));
  return query select p_submission_id, v_status, v_patient_id, v_patient_number;
end;
$$;

revoke all on function public.info_officer_pending_patient_submissions() from public, anon;
revoke all on function public.info_officer_review_patient_submission(uuid, boolean) from public, anon;
grant execute on function public.info_officer_pending_patient_submissions() to authenticated;
grant execute on function public.info_officer_review_patient_submission(uuid, boolean) to authenticated;

commit;
