-- Include catalog type in the staff-only inventory workspace response.
drop function if exists public.staff_inventory_items(public.request_type);

create function public.staff_inventory_items(p_department public.request_type)
returns table (
  id uuid,
  department public.request_type,
  item_name text,
  item_code text,
  unit text,
  quantity_on_hand integer,
  unit_price numeric,
  unit_cost numeric,
  low_stock_threshold integer,
  is_active boolean,
  catalog_type text
)
language plpgsql security definer set search_path = ''
as $$
declare v_role public.staff_role; v_active boolean;
begin
  select sp.role,sp.is_active into v_role,v_active
  from public.staff_profiles sp where sp.user_id=auth.uid();
  if auth.uid() is null or coalesce(v_active,false) is not true then
    raise exception using errcode='42501', message='Active staff access is required.';
  end if;
  if (v_role='pharmacy' and p_department<>'medicine')
     or (v_role='lab' and p_department<>'lab')
     or v_role not in ('pharmacy','lab') then
    raise exception using errcode='42501', message='You can only access your department inventory.';
  end if;
  return query
    select i.id,i.department,i.item_name,i.item_code,i.unit,i.quantity_on_hand,
           i.unit_price,i.unit_cost,i.low_stock_threshold,i.is_active,i.catalog_type
    from public.inventory_items i
    where i.department=p_department
    order by i.item_name;
end;
$$;
revoke all on function public.staff_inventory_items(public.request_type) from public, anon;
grant execute on function public.staff_inventory_items(public.request_type) to authenticated;
