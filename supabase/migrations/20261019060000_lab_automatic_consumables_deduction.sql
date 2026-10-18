-- Configure per-test laboratory consumables and deduct them atomically during fulfillment.
begin;

create table if not exists public.inventory_consumable_recipes (
  id uuid primary key default gen_random_uuid(),
  department public.request_type not null default 'lab' check (department = 'lab'),
  service_item_id uuid not null references public.inventory_items(id) on delete cascade,
  supply_item_id uuid not null references public.inventory_items(id) on delete restrict,
  quantity_per_service integer not null check (quantity_per_service > 0),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(service_item_id, supply_item_id)
);
alter table public.inventory_consumable_recipes enable row level security;
revoke all on public.inventory_consumable_recipes from anon, authenticated;

create or replace function public.staff_inventory_consumable_recipes()
returns table(id uuid, service_item_id uuid, service_name text, service_code text,
  supply_item_id uuid, supply_name text, supply_code text, supply_unit text,
  quantity_per_service integer, supply_stock integer)
language plpgsql security definer set search_path = ''
as $$
declare v_role public.staff_role; v_active boolean;
begin
  select sp.role,sp.is_active into v_role,v_active from public.staff_profiles sp where sp.user_id=auth.uid();
  if auth.uid() is null or coalesce(v_active,false) is not true then
    raise exception using errcode='42501',message='Active staff access is required.';
  end if;
  if v_role<>'lab' then raise exception using errcode='42501',message='Only Laboratory staff can manage laboratory consumable recipes.'; end if;
  return query
    select rec.id,rec.service_item_id,svc.item_name,svc.item_code,rec.supply_item_id,
      sup.item_name,sup.item_code,sup.unit,rec.quantity_per_service,sup.quantity_on_hand
    from public.inventory_consumable_recipes rec
    join public.inventory_items svc on svc.id=rec.service_item_id
    join public.inventory_items sup on sup.id=rec.supply_item_id
    where svc.department='lab' and svc.catalog_type='requestable'
      and sup.department='lab' and sup.catalog_type='supply'
    order by svc.item_name,sup.item_name;
end;
$$;
revoke all on function public.staff_inventory_consumable_recipes() from public,anon;
grant execute on function public.staff_inventory_consumable_recipes() to authenticated;

create or replace function public.inventory_save_consumable_recipe(p_service_item_id uuid,p_supply_item_id uuid,p_quantity_per_service integer)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_role public.staff_role; v_active boolean; v_id uuid;
begin
  select sp.role,sp.is_active into v_role,v_active from public.staff_profiles sp where sp.user_id=auth.uid();
  if auth.uid() is null or coalesce(v_active,false) is not true then
    raise exception using errcode='42501',message='Active staff access is required.';
  end if;
  if v_role<>'lab' then raise exception using errcode='42501',message='Only Laboratory staff can manage laboratory consumable recipes.'; end if;
  if p_quantity_per_service is null or p_quantity_per_service<=0 then
    raise exception using errcode='22023',message='Consumable quantity per test must be greater than zero.';
  end if;
  if not exists(select 1 from public.inventory_items where id=p_service_item_id and department='lab' and catalog_type='requestable' and is_active) then
    raise exception using errcode='22023',message='Choose an active laboratory test/service.';
  end if;
  if not exists(select 1 from public.inventory_items where id=p_supply_item_id and department='lab' and catalog_type='supply' and is_active) then
    raise exception using errcode='22023',message='Choose an active laboratory supply.';
  end if;
  insert into public.inventory_consumable_recipes(department,service_item_id,supply_item_id,quantity_per_service,created_by)
  values('lab',p_service_item_id,p_supply_item_id,p_quantity_per_service,auth.uid())
  on conflict(service_item_id,supply_item_id) do update
    set quantity_per_service=excluded.quantity_per_service,updated_at=now()
  returning id into v_id;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,details)
  values(auth.uid(),'lab_consumable_recipe_saved','inventory_consumable_recipe',v_id::text,
    jsonb_build_object('service_item_id',p_service_item_id,'supply_item_id',p_supply_item_id,'quantity_per_service',p_quantity_per_service));
  return v_id;
end;
$$;
revoke all on function public.inventory_save_consumable_recipe(uuid,uuid,integer) from public,anon;
grant execute on function public.inventory_save_consumable_recipe(uuid,uuid,integer) to authenticated;

create or replace function public.inventory_delete_consumable_recipe(p_recipe_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_role public.staff_role; v_active boolean;
begin
  select sp.role,sp.is_active into v_role,v_active from public.staff_profiles sp where sp.user_id=auth.uid();
  if auth.uid() is null or coalesce(v_active,false) is not true then
    raise exception using errcode='42501',message='Active staff access is required.';
  end if;
  if v_role<>'lab' then raise exception using errcode='42501',message='Only Laboratory staff can manage laboratory consumable recipes.'; end if;
  delete from public.inventory_consumable_recipes where id=p_recipe_id;
  if not found then raise exception using errcode='P0002',message='Consumable recipe not found.'; end if;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,details)
  values(auth.uid(),'lab_consumable_recipe_deleted','inventory_consumable_recipe',p_recipe_id::text,'{}'::jsonb);
end;
$$;
revoke all on function public.inventory_delete_consumable_recipe(uuid) from public,anon;
grant execute on function public.inventory_delete_consumable_recipe(uuid) to authenticated;

create or replace function public.fulfill_hms_request(p_request_id uuid,p_lab_result text default null)
returns uuid language plpgsql security definer set search_path = ''
as $function$
declare
  r public.requests%rowtype; l public.request_items%rowtype; i public.inventory_items%rowtype;
  recipe record; role_name public.staff_role; active boolean; revenue numeric(12,2); cost numeric(12,2);
begin
  select role,is_active into role_name,active from public.staff_profiles where user_id=auth.uid();
  if auth.uid() is null or coalesce(active,false) is not true then
    raise exception using errcode='42501',message='Active staff access is required.';
  end if;
  select * into r from public.requests where id=p_request_id for update;
  if not found then raise exception using errcode='P0002',message='Request not found.'; end if;
  if (r.type='medicine' and role_name<>'pharmacy') or (r.type='lab' and role_name<>'lab') then
    raise exception using errcode='42501',message='Only the assigned department can fulfill this request.';
  end if;
  if r.status<>'paid' then raise exception using errcode='22023',message='Cashier payment is required before fulfillment.'; end if;
  if r.type='lab' and nullif(trim(p_lab_result),'') is null then
    raise exception using errcode='22023',message='Enter the lab result before releasing this request.';
  end if;
  if not exists(select 1 from public.request_items where request_id=p_request_id) then
    raise exception using errcode='22023',message='This request has no items to fulfill.';
  end if;

  -- Validate and lock requestable stock first. Any later error rolls back the entire transaction.
  for l in select * from public.request_items where request_id=p_request_id order by inventory_item_id,id loop
    if l.inventory_item_id is null or exists(select 1 from public.profit_inventory where request_item_id=l.id) then
      raise exception using errcode='22023',message='Request item inventory has already been processed or is not linked.';
    end if;
    select * into i from public.inventory_items where id=l.inventory_item_id for update;
    if not found or i.department<>r.type or i.catalog_type<>'requestable' then
      raise exception using errcode='22023',message='A requested item is unavailable in the correct department inventory.';
    end if;
    if i.quantity_on_hand<l.quantity then
      raise exception using errcode='22023',message='Current stock is insufficient to fulfill this request.';
    end if;
  end loop;

  -- Lock and validate each distinct consumable, aggregating demand across all tests in the request.
  if r.type='lab' then
    for recipe in
      select rec.supply_item_id, sum(rec.quantity_per_service*ri.quantity)::integer as required_quantity,
        sup.item_name
      from public.request_items ri
      join public.inventory_consumable_recipes rec on rec.service_item_id=ri.inventory_item_id
      join public.inventory_items sup on sup.id=rec.supply_item_id
      where ri.request_id=p_request_id
      group by rec.supply_item_id,sup.item_name
      order by rec.supply_item_id
    loop
      select * into i from public.inventory_items where id=recipe.supply_item_id for update;
      if not found or i.catalog_type<>'supply' or i.department<>'lab' or i.quantity_on_hand<recipe.required_quantity then
        raise exception using errcode='22023',
          message=format('Insufficient consumable stock for %s. Replenish stock before releasing this lab request.',recipe.item_name);
      end if;
    end loop;
  end if;

  for l in select * from public.request_items where request_id=p_request_id order by inventory_item_id,id loop
    select * into i from public.inventory_items where id=l.inventory_item_id for update;
    update public.inventory_items set quantity_on_hand=i.quantity_on_hand-l.quantity,updated_at=now() where id=i.id;
    revenue:=round(l.unit_price*l.quantity,2); cost:=round(l.unit_cost*l.quantity,2);
    insert into public.profit_inventory(request_item_id,request_id,department,quantity,revenue,cost,profit)
    values(l.id,p_request_id,r.type,l.quantity,revenue,cost,revenue-cost);
  end loop;

  if r.type='lab' then
    for recipe in
      select rec.supply_item_id,sum(rec.quantity_per_service*ri.quantity)::integer as required_quantity
      from public.request_items ri join public.inventory_consumable_recipes rec on rec.service_item_id=ri.inventory_item_id
      where ri.request_id=p_request_id group by rec.supply_item_id order by rec.supply_item_id
    loop
      update public.inventory_items set quantity_on_hand=quantity_on_hand-recipe.required_quantity,updated_at=now()
      where id=recipe.supply_item_id and quantity_on_hand>=recipe.required_quantity;
      if not found then raise exception using errcode='22023',message='Consumable stock changed during fulfillment. Refresh and retry.'; end if;
    end loop;
  end if;

  update public.requests set status='released',
    lab_result=case when r.type='lab' then trim(p_lab_result) else null end,
    fulfilled_at=now(),fulfilled_by=auth.uid(),updated_at=now()
  where id=p_request_id;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,details)
  values(auth.uid(),'request_fulfilled','request',p_request_id::text,
    jsonb_build_object('type',r.type,'stock_deducted',true,'consumables_deducted',r.type='lab','profit_recorded',true));
  return p_request_id;
end;
$function$;
revoke all on function public.fulfill_hms_request(uuid,text) from public,anon;
grant execute on function public.fulfill_hms_request(uuid,text) to authenticated;
commit;
