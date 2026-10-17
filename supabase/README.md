# HMS Supabase

## Connected project baseline

The connected project is **HMS** (`vdvoyvietqkraazpvohu`, region `ap-northeast-1`). The empty state was verified on 2026-10-17 and captured in [baseline.sql](./baseline.sql). The current schema is created by timestamped migrations in `supabase/migrations/`.

The older project reference and pre-existing-schema description in planning notes do not match the connected project. This repository follows the live HMS project identified above.

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

## Role-scoped reads

Clinical and financial tables remain unavailable for direct client reads. Staff-facing reads are exposed through role-checking RPCs:

- `staff_patient_directory(search)`: cross-ward patient lookup, with contact/address fields limited to Information Officer and Emergency Nurse; cashier receives only the PWD/Senior flag needed for billing.
- `staff_encounter_queue(status)`: Emergency Nurse queue; Nurse Station sees clinical encounter details only for its assigned ward.
- `staff_request_queue(type)`: type-limited queues for Pharmacy/Lab, payment coordination for Cashier, creator/encounter-scoped requests for Emergency Nurse, and ward-scoped requests for Nurse Station.
- `staff_bed_census()`: active bed availability only; private rooms are treated as one reservation when any bed in that room is occupied.
- `staff_inventory_catalog_safe(department)`: only Pharmacy or Lab can read its own department catalog; unit cost is not returned.
- `admin_staff_directory()`: active administrators only.

All these functions are `SECURITY DEFINER` RPCs with an empty search path and explicit active-profile/role checks. They are intentionally executable by `authenticated` so the database can validate the caller's staff role; keep the security-advisor warning tracked and continue testing negative cases. The original inventory catalog RPC is revoked; use only the guarded `staff_inventory_catalog_safe` function.

## First administrator bootstrap

The connected project currently has no Auth users or staff profiles. The first administrator must be bootstrapped once by a project owner; the regular staff invitation endpoint intentionally requires an existing active administrator.

1. In **Supabase Dashboard → Authentication → Users**, create the first trusted administrator account with the intended email. Use a real staff-owned email and require email confirmation.
2. In **SQL Editor**, replace the email literal below with that exact address and run it once. Confirm the returned row is the intended user before continuing.

```sql
insert into public.staff_profiles (user_id, email, display_name, role, is_active)
select u.id, lower(u.email), 'HMS Administrator', 'admin'::public.staff_role, true
from auth.users u
where lower(u.email) = lower('replace-with-admin-email@example.com')
  and not exists (select 1 from public.staff_profiles sp where sp.user_id = u.id)
returning user_id, email, role, is_active;
```

3. If no row is returned, verify the Auth email and whether a staff profile already exists. Do not bypass RLS or expose a service-role key to the frontend.
4. Sign in through HMS. Use **Staff** to invite other users; invitation and profile creation are handled by the admin-invite-staff Edge Function, which verifies the caller's active administrator profile server-side.
5. Set the Auth email redirect URL to the deployed HMS origin and configure SMTP/email delivery in Supabase before sending production invitations.

Never use this bootstrap to grant administrator access to an untrusted account. Keep the first administrator's recovery email and MFA under the hospital's control.

## Deployment and verification

- Apply migrations in timestamp order to the intended project. The hms_staff_admin_audit migration is required for staff role changes and audit-log viewing.
- Deploy `supabase/functions/admin-invite-staff/index.ts` as `admin-invite-staff` with JWT verification enabled. Set the `HMS_ALLOWED_ORIGIN` Edge Function secret to the exact deployed HMS origin (scheme + hostname + any non-default port, no trailing slash). The function now fails closed if this secret is missing; do not restore a wildcard (`*`) fallback. It uses server-side Supabase environment variables and must never expose the service-role key to the browser.
- Configure the frontend environment using .env.example; set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY only.
- Test every role using separate real test accounts, including negative cases (wrong ward, wrong department, unauthorized billing, and inactive staff). Do not use fabricated patient or billing data in production.
- Verify Auth email delivery, recovery, allowed redirect URLs, and session expiry before go-live.

## Current database status

- Foundational tables and RLS are applied.
- The four canonical wards exist with public rate ₱800 and private rate ₱5,000.
- No beds, staff, doctors, patients, inventory items, or user accounts have been seeded.
- Administrative room/bed/rate changes are exposed only through role-checked RPCs.
- Role-scoped read RPCs are applied. Clinical/financial base tables remain closed to direct client access.
- The first administrator must be bootstrapped manually using the steps above. Real JWT-based role-by-role integration tests remain outstanding; do not mark the access matrix fully tested until those tests run.
