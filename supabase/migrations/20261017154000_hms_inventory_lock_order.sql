-- Keep inventory row locks in a consistent order across concurrent fulfillment transactions.
-- This reduces deadlocks when different requests contain overlapping inventory items.
create or replace function public.fulfill_hms_request(p_request_id uuid,p_lab_result text default null)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  r public.requests%rowtype;
  l public.request_items%rowtype;
  i public.inventory_items%rowtype;
  role_name public.staff_role;
  active boolean;
  revenue numeric(12,2);
  cost numeric(12,2);
begin
  select role,is_active into role_name,active
  from public.staff_profiles
  where user_id=auth.uid();

  if auth.uid() is null or coalesce(active,false) is not true then
    raise exception using errcode='42501',message='Active staff access is required.';
  end if;

  select * into r from public.requests where id=p_request_id for update;
  if not found then
    raise exception using errcode='P0002',message='Request not found.';
  end if;
  if (r.type='medicine' and role_name<>'pharmacy') or (r.type='lab' and role_name<>'lab') then
    raise exception using errcode='42501',message='Only the assigned department can fulfill this request.';
  end if;
  if r.status<>'paid' then
    raise exception using errcode='22023',message='Cashier payment is required before fulfillment.';
  end if;
  if r.type='lab' and nullif(trim(p_lab_result),'') is null then
    raise exception using errcode='22023',message='Enter the lab result before releasing this request.';
  end if;
  if not exists(select 1 from public.request_items where request_id=p_request_id) then
    raise exception using errcode='22023',message='This request has no items to fulfill.';
  end if;

  -- Lock inventory rows by their primary key, not request-item insertion order.
  for l in
    select * from public.request_items
    where request_id=p_request_id
    order by inventory_item_id,id
  loop
    if l.inventory_item_id is null or exists(select 1 from public.profit_inventory where request_item_id=l.id) then
      raise exception using errcode='22023',message='Request item inventory has already been processed or is not linked.';
    end if;

    select * into i from public.inventory_items where id=l.inventory_item_id for update;
    if not found or i.department<>r.type then
      raise exception using errcode='22023',message='A requested item is unavailable in the correct department inventory.';
    end if;
    if i.quantity_on_hand<l.quantity then
      raise exception using errcode='22023',message='Current stock is insufficient to fulfill this request.';
    end if;

    update public.inventory_items
    set quantity_on_hand=i.quantity_on_hand-l.quantity,updated_at=now()
    where id=i.id;

    revenue:=round(l.unit_price*l.quantity,2);
    cost:=round(l.unit_cost*l.quantity,2);
    insert into public.profit_inventory(request_item_id,request_id,department,quantity,revenue,cost,profit)
    values(l.id,p_request_id,r.type,l.quantity,revenue,cost,revenue-cost);
  end loop;

  update public.requests
  set status='released',
      lab_result=case when r.type='lab' then trim(p_lab_result) else null end,
      fulfilled_at=now(),
      fulfilled_by=auth.uid(),
      updated_at=now()
  where id=p_request_id;

  insert into public.audit_logs(actor_id,action,entity_type,entity_id,details)
  values(auth.uid(),'request_fulfilled','request',p_request_id::text,
         jsonb_build_object('type',r.type,'stock_deducted',true,'profit_recorded',true));
  return p_request_id;
end;
$$;

revoke all on function public.fulfill_hms_request(uuid,text) from public,anon;
grant execute on function public.fulfill_hms_request(uuid,text) to authenticated;
