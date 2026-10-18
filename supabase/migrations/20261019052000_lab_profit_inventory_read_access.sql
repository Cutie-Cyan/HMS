-- Allow active Laboratory staff to read laboratory profit records only.
-- Inserts remain owned by the guarded fulfillment RPC.
grant select on table public.profit_inventory to authenticated;

drop policy if exists lab_read_laboratory_profit_records on public.profit_inventory;
create policy lab_read_laboratory_profit_records
on public.profit_inventory
for select
to authenticated
using (
  department::text = 'lab'
  and exists (
    select 1
    from public.staff_profiles sp
    where sp.user_id = (select auth.uid())
      and sp.role::text = 'lab'
      and sp.is_active = true
  )
);
