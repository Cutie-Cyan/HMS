# HMS Supabase

## Connected project baseline

The connected project is **HMS** (`vdvoyvietqkraazpvohu`, region `ap-northeast-1`). The empty state was verified on 2026-10-17 and captured in [baseline.sql](./baseline.sql). The current schema is created by timestamped migrations in `supabase/migrations/`.

The older project reference and pre-existing-schema description in the planning notes do not match the connected project. This repository follows the live HMS project identified above.

## Migration policy

- Use new timestamped migrations; never edit or replay an already-applied migration.
- Do not seed fake beds, staff, doctors, patients, inventory, or accounts. The four canonical ward records are system configuration.
- Enable RLS on every exposed application table and enforce authorization in database policies, RPCs, constraints, and triggers.
- Never put a service-role or secret key in frontend code or commit `.env`.
- Keep monetary amounts in PostgreSQL `numeric(12,2)`; calculate billing totals in database logic, not the browser.
- Doctors do not have accounts or a system role.
- The only wards are Emergency Room, Female Ward, Male Ward, and Pedia Ward.
- Public beds cost ₱800 per rolling 24-hour period. A private room costs ₱5,000 per rolling 24-hour period and reserves the entire room; admission enforcement is added with the admission workflow.
- PhilHealth is a ₱2,000 discount per admission. PhilHealth and PWD/Senior discounts may stack, but discounts within the same category may not stack; enforcement is added with billing.
- The doctor form is recorded by the Emergency Nurse. Patient information is at the top, Findings on the left, Recommendation on the right. “HTI” is not a separate field; UTI is an example finding.

## Current database status

- Foundational tables and RLS are applied.
- The four canonical wards exist with public rate ₱800 and private rate ₱5,000.
- No beds, staff, doctors, patients, inventory items, or user accounts have been seeded.
- Administrative room/bed/rate changes are exposed only through role-checked RPCs.
- Clinical/financial tables currently have no direct client policies. Their role-scoped access and business workflow RPCs must be implemented before those screens are enabled.
