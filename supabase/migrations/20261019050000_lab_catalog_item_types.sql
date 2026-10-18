-- Add explicit catalog types so laboratory services are requestable while consumables remain internal stock.
begin;

alter table public.inventory_items
  add column if not exists catalog_type text not null default 'requestable'
  check (catalog_type in ('requestable', 'supply'));

-- Existing catalog entries keep their current requestable behavior.
create or replace function public.staff_requestable_items(p_department public.request_type)
returns table(id uuid, department public.request_type, item_name text, item_code text, unit text, quantity_on_hand integer, unit_price numeric)
language plpgsql security definer set search_path = '' as $$
declare v_role public.staff_role; v_active boolean;
begin
  select sp.role,sp.is_active into v_role,v_active
  from public.staff_profiles sp where sp.user_id=auth.uid();
  if auth.uid() is null or coalesce(v_active,false) is not true then
    raise exception using errcode='42501', message='Active staff access is required.';
  end if;
  if v_role not in ('emergency_nurse','nurse_station','pharmacy','lab') then
    raise exception using errcode='42501', message='Your staff role cannot view requestable items.';
  end if;
  if (v_role='pharmacy' and p_department<>'medicine') or (v_role='lab' and p_department<>'lab') then
    raise exception using errcode='42501', message='You can only view your department items.';
  end if;
  return query
    select i.id,i.department,i.item_name,i.item_code,i.unit,i.quantity_on_hand,i.unit_price
    from public.inventory_items i
    where i.department=p_department and i.is_active=true and i.catalog_type='requestable'
    order by i.item_name;
end;
$$;
revoke all on function public.staff_requestable_items(public.request_type) from public, anon;
grant execute on function public.staff_requestable_items(public.request_type) to authenticated;

-- Dedicated typed save RPC. It preserves department guards and prevents accidental stock edits.
create or replace function public.inventory_save_item_typed(
  p_department public.request_type,
  p_item_name text,
  p_item_code text,
  p_unit text,
  p_quantity_on_hand integer,
  p_unit_price numeric,
  p_unit_cost numeric,
  p_low_stock_threshold integer,
  p_expected_quantity integer default null,
  p_item_id uuid default null,
  p_catalog_type text default 'requestable'
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare v_role public.staff_role; v_active boolean; v_id uuid; v_current_quantity integer;
begin
  select sp.role,sp.is_active into v_role,v_active
  from public.staff_profiles sp where sp.user_id=auth.uid();
  if auth.uid() is null or coalesce(v_active,false) is not true then
    raise exception using errcode='42501', message='Active staff access is required.';
  end if;
  if (v_role='pharmacy' and p_department<>'medicine')
     or (v_role='lab' and p_department<>'lab')
     or v_role not in ('pharmacy','lab') then
    raise exception using errcode='42501', message='You can only manage your department inventory.';
  end if;
  if nullif(trim(p_item_name),'') is null or nullif(trim(p_item_code),'') is null
     or nullif(trim(p_unit),'') is null or p_quantity_on_hand<0 or p_unit_price<0
     or p_unit_cost<0 or p_low_stock_threshold<0
     or p_catalog_type not in ('requestable','supply') then
    raise exception using errcode='22023', message='Enter valid item details, type, stock, and prices.';
  end if;
  if p_item_id is null then
    insert into public.inventory_items(department,item_name,item_code,unit,quantity_on_hand,unit_price,unit_cost,low_stock_threshold,created_by,catalog_type)
    values(p_department,trim(p_item_name),trim(p_item_code),trim(p_unit),p_quantity_on_hand,p_unit_price,p_unit_cost,p_low_stock_threshold,auth.uid(),p_catalog_type)
    returning id into v_id;
  else
    select quantity_on_hand into v_current_quantity from public.inventory_items
    where id=p_item_id and department=p_department for update;
    if not found then
      raise exception using errcode='P0002', message='Inventory item not found in your department.';
    end if;
    if p_expected_quantity is not null and v_current_quantity<>p_expected_quantity then
      raise exception using errcode='40001', message='Stock changed since you opened this item.';
    end if;
    update public.inventory_items
    set item_name=trim(p_item_name), item_code=trim(p_item_code), unit=trim(p_unit),
        unit_price=p_unit_price, unit_cost=p_unit_cost, low_stock_threshold=p_low_stock_threshold,
        catalog_type=p_catalog_type, updated_at=now()
    where id=p_item_id and department=p_department returning id into v_id;
  end if;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,details)
  values(auth.uid(),case when p_item_id is null then 'inventory_item_created' else 'inventory_item_updated' end,
    'inventory_item',v_id::text,jsonb_build_object('department',p_department,'item_code',trim(p_item_code),
    'catalog_type',p_catalog_type,'quantity_on_hand',p_quantity_on_hand));
  return v_id;
end;
$$;
revoke all on function public.inventory_save_item_typed(public.request_type,text,text,text,integer,numeric,numeric,integer,integer,uuid,text) from public, anon;
grant execute on function public.inventory_save_item_typed(public.request_type,text,text,text,integer,numeric,numeric,integer,integer,uuid,text) to authenticated;

commit;
