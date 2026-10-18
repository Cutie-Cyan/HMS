-- Allow active Pharmacy staff to read medicine profit records only.
-- Keep write access controlled by the existing database workflow/RPCs.
grant select on table public.profit_inventory to authenticated;

drop policy if exists pharmacy_read_medicine_profit_records on public.profit_inventory;
create policy pharmacy_read_medicine_profit_records
on public.profit_inventory
for select
to authenticated
using (
  department::text = 'medicine'
  and exists (
    select 1
    from public.staff_profiles sp
    where sp.user_id = (select auth.uid())
      and sp.role::text = 'pharmacy'
      and sp.is_active = true
  )
);
