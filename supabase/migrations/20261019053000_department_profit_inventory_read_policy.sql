-- Keep department-scoped profit access in one SELECT policy.
drop policy if exists pharmacy_read_medicine_profit_records on public.profit_inventory;
drop policy if exists lab_read_laboratory_profit_records on public.profit_inventory;
drop policy if exists department_profit_records_read on public.profit_inventory;

create policy department_profit_records_read
on public.profit_inventory
for select
to authenticated
using (
  (
    department::text = 'medicine'
    and exists (
      select 1 from public.staff_profiles sp
      where sp.user_id = (select auth.uid())
        and sp.role::text = 'pharmacy'
        and sp.is_active = true
    )
  )
  or
  (
    department::text = 'lab'
    and exists (
      select 1 from public.staff_profiles sp
      where sp.user_id = (select auth.uid())
        and sp.role::text = 'lab'
        and sp.is_active = true
    )
  )
);
