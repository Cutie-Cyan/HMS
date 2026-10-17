-- Inventory catalog exposes only a staff member's own department and never unit cost.
create or replace function public.staff_inventory_catalog_safe(p_department public.request_type default null)
returns table (item_id uuid, department public.request_type, item_name text, item_code text, unit text, quantity_on_hand integer, unit_price numeric, low_stock_threshold integer, is_active boolean, updated_at timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
declare v_actor uuid := auth.uid(); v_role public.staff_role; v_department public.request_type;
begin
 select sp.role into v_role from public.staff_profiles sp where sp.user_id=v_actor and sp.is_active=true;
 if v_actor is null or v_role is null or v_role not in ('pharmacy'::public.staff_role,'lab'::public.staff_role) then raise exception using errcode='42501',message='Pharmacy or Laboratory access is required.'; end if;
 v_department := case when v_role='pharmacy'::public.staff_role then 'medicine'::public.request_type else 'lab'::public.request_type end;
 if p_department is not null and p_department<>v_department then raise exception using errcode='42501',message='This role cannot access another department inventory.'; end if;
 return query select i.id,i.department,i.item_name,i.item_code,i.unit,i.quantity_on_hand,i.unit_price,i.low_stock_threshold,i.is_active,i.updated_at from public.inventory_items i where i.department=v_department order by i.item_name limit 500;
end;
$$;
revoke all on function public.staff_inventory_catalog_safe(public.request_type) from public,anon;
grant execute on function public.staff_inventory_catalog_safe(public.request_type) to authenticated;