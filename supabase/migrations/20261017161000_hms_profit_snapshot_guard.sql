-- Keep inventory profit records consistent with the request-item snapshots they represent.
-- Revenue and cost must use the saved request-item price/cost, not today's inventory prices.
begin;

create or replace function public.enforce_hms_profit_snapshot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.request_items%rowtype;
  v_request_type public.request_type;
begin
  select ri.* into v_item
  from public.request_items ri
  where ri.id = new.request_item_id;

  if not found then
    raise exception using errcode = '23503',
      message = 'Profit record must reference an existing request item.';
  end if;

  select r.type into v_request_type
  from public.requests r
  where r.id = v_item.request_id;

  if not found then
    raise exception using errcode = '23503',
      message = 'Profit record request item must reference an existing request.';
  end if;

  if new.request_id is distinct from v_item.request_id
     or new.department is distinct from v_request_type
     or new.quantity is distinct from v_item.quantity
     or new.revenue is distinct from round(v_item.unit_price * v_item.quantity, 2)
     or new.cost is distinct from round(v_item.unit_cost * v_item.quantity, 2)
     or new.profit is distinct from round(v_item.unit_price * v_item.quantity, 2)
                                  - round(v_item.unit_cost * v_item.quantity, 2) then
    raise exception using errcode = '23514',
      message = 'Profit values must match the linked request item price, cost, quantity, and department snapshots.';
  end if;

  return new;
end;
$$;

drop trigger if exists profit_inventory_snapshot_guard on public.profit_inventory;
create trigger profit_inventory_snapshot_guard
before insert or update of request_item_id, request_id, department, quantity, revenue, cost, profit
on public.profit_inventory
for each row execute function public.enforce_hms_profit_snapshot();

revoke all on function public.enforce_hms_profit_snapshot() from public, anon, authenticated;

commit;
