-- Allow the public self-registration form to insert pending submissions.
-- The existing RLS policy still restricts inserts to valid, pending submissions.
grant insert on table public.patient_registration_submissions to anon, authenticated;
