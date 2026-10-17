# HMS Supabase

## Connected project baseline

The connected project is **HMS** (`vdvoyvietqkraazpvohu`, region `ap-northeast-1`).
As verified on 2026-10-17, the application `public` schema has no tables and
 the project reports no applied migrations. See [baseline.sql](./baseline.sql).

The older project reference and pre-existing-schema description in the planning
notes do not match the currently connected project. This repository follows the
live HMS project identified above.

## Migration policy

- Create new timestamped migrations under `supabase/migrations/`.
- Do not put seed data in migrations.
- Enable RLS on every exposed application table and enforce role authorization
  in database policies, RPCs, and constraints/triggers where appropriate.
- Never put a service-role or secret key in frontend code or commit `.env`.
- Keep monetary amounts in PostgreSQL `numeric(12,2)`; billing totals come from
  database billing logic, not browser calculations.
- Do not add a doctor login or role.
- The only wards are Emergency Room, Female Ward, Male Ward, and Pedia Ward.
- Public beds cost ₱800 per rolling 24-hour period. A private room costs ₱5,000
  per rolling 24-hour period and reserves the entire room.
- PhilHealth is a ₱2,000 discount per admission. PhilHealth and PWD/Senior
  discounts may stack, but discounts within the same category may not stack.
- The doctor form is recorded by the Emergency Nurse. It contains patient
  information at the top, Findings on the left, and Recommendation on the
  right (medications/lab requests). “HTI” is not a separate field; UTI is an
  example finding.

The schema will be added only through reviewed, new migrations as the build
progresses. No beds, staff, doctors, patients, inventory, or accounts are seeded.
