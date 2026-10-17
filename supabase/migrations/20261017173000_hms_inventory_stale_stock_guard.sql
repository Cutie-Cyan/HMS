-- Prevent stale inventory edit forms from overwriting stock deductions or adjustments.
-- Existing stock must still match the quantity the editor originally loaded.
create function public.inventory_save_item(
  p_department public.request_type,
  p_item_name text,
  p_item_code text,
  p_unit text,
  p_quantity_on_hand integer,
  p_unit_price numeric,
  p_unit_cost numeric,
  p_low_stock_threshold integer,
  p_expected_quantity integer,
  p_item_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.staff_role;
  v_active boolean;
  v_id uuid;
  v_old public.inventory_items%rowtype;
begin
  select sp.role,sp.is_active
    into v_role,v_active
  from public.staff_profiles sp
  where sp.user_id=auth.uid();

  if auth.uid() is null or coalesce(v_active,false) is not true then
    raise exception using errcode='42501',message='Active staff access is required.';
  end if;
  if (v_role='pharmacy' and p_department<>'medicine')
     or (v_role='lab' and p_department<>'lab')
     or v_role not in ('pharmacy','lab') then
    raise exception using errcode='42501',message='You can only manage your department inventory.';
  end if;
  if nullif(trim(p_item_name),'') is null
     or nullif(trim(p_item_code),'') is null
     or nullif(trim(p_unit),'') is null
     or p_quantity_on_hand is null or p_quantity_on_hand<0
     or p_unit_price is null or p_unit_price<0
     or p_unit_cost is null or p_unit_cost<0
     or p_low_stock_threshold is null or p_low_stock_threshold<0 then
    raise exception using errcode='22023',message='Enter a name, code, unit, and non-negative stock and price values.';
  end if;

  if p_item_id is null then
    insert into public.inventory_items(
      department,item_name,item_code,unit,quantity_on_hand,unit_price,unit_cost,
      low_stock_threshold,created_by
    )
    values(
      p_department,trim(p_item_name),trim(p_item_code),trim(p_unit),
      p_quantity_on_hand,p_unit_price,p_unit_cost,p_low_stock_threshold,auth.uid()
    )
    returning id into v_id;
  else
    select * into v_old
    from public.inventory_items
    where id=p_item_id and department=p_department
    for update;

    if not found then
      raise exception using errcode='P0002',message='Inventory item not found in your department.';
    end if;
    if p_expected_quantity is null or v_old.quantity_on_hand is distinct from p_expected_quantity then
      raise exception using errcode='40001',message='Stock changed since you opened this item. Refresh inventory and review the current quantity before saving.';
    end if;

    update public.inventory_items
    set item_name=trim(p_item_name),
        item_code=trim(p_item_code),
        unit=trim(p_unit),
        quantity_on_hand=p_quantity_on_hand,
        unit_price=p_unit_price,
        unit_cost=p_unit_cost,
        low_stock_threshold=p_low_stock_threshold,
        updated_at=now()
    where id=p_item_id and department=p_department
    returning id into v_id;
  end if;

  insert into public.audit_logs(actor_id,action,entity_type,entity_id,details)
  values(
    auth.uid(),
    case when p_item_id is null then 'inventory_item_created' else 'inventory_item_updated' end,
    'inventory_item',
    v_id::text,
    jsonb_build_object(
      'department',p_department,
      'item_code',trim(p_item_code),
      'before',case when p_item_id is null then null else jsonb_build_object(
        'item_name',v_old.item_name,
        'item_code',v_old.item_code,
        'unit',v_old.unit,
        'quantity_on_hand',v_old.quantity_on_hand,
        'unit_price',v_old.unit_price,
        'unit_cost',v_old.unit_cost,
        'low_stock_threshold',v_old.low_stock_threshold
      ) end,
      'after',jsonb_build_object(
        'item_name',trim(p_item_name),
        'item_code',trim(p_item_code),
        'unit',trim(p_unit),
        'quantity_on_hand',p_quantity_on_hand,
        'unit_price',p_unit_price,
        'unit_cost',p_unit_cost,
        'low_stock_threshold',p_low_stock_threshold
      )
    )
  );
  return v_id;
end;
$$;


revoke all on function public.inventory_save_item(public.request_type,text,text,text,integer,numeric,numeric,integer,integer,uuid) from public,anon;
grant execute on function public.inventory_save_item(public.request_type,text,text,text,integer,numeric,numeric,integer,integer,uuid) to authenticated;
revoke all on function public.inventory_save_item(public.request_type,text,text,text,integer,numeric,numeric,integer,uuid) from public,anon;
drop function public.inventory_save_item(public.request_type,text,text,text,integer,numeric,numeric,integer,uuid);
