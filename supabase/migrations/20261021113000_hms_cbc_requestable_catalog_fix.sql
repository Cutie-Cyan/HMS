-- Ensure existing CBC laboratory catalog entries are visible to staff making requests.
-- Consumable supplies remain supplies; only explicitly named CBC test/service entries are promoted.
begin;

update public.inventory_items
set catalog_type = 'requestable',
    updated_at = now()
where department = 'lab'
  and is_active = true
  and catalog_type = 'supply'
  and (
    lower(coalesce(item_code, '')) like '%cbc%'
    or lower(coalesce(item_name, '')) like '%cbc%'
    or lower(coalesce(item_name, '')) like '%complete blood count%'
  );

create or replace function public.staff_requestable_items(p_department public.request_type)
returns table(id uuid, department public.request_type, item_name text, item_code text, unit text, quantity_on_hand integer, unit_price numeric)
language plpgsql security definer set search_path = '' as $
declare v_role public.staff_role; v_active boolean;
begin
  select sp.role,sp.is_active into v_role,v_active from public.staff_profiles sp where sp.user_id=auth.uid();
  if auth.uid() is null or coalesce(v_active,false) is not true then raise exception using errcode='42501', message='Active staff access is required.'; end if;
  if v_role not in ('emergency_nurse','nurse_station','pharmacy','lab') then raise exception using errcode='42501', message='Your staff role cannot view requestable items.'; end if;
  if (v_role='pharmacy' and p_department<>'medicine') or (v_role='lab' and p_department<>'lab') then raise exception using errcode='42501', message='You can only view your department items.'; end if;
  return query select i.id,i.department,i.item_name,i.item_code,i.unit,i.quantity_on_hand,i.unit_price
  from public.inventory_items i
  where i.department=p_department and i.is_active=true
    and (i.catalog_type='requestable' or (p_department='lab' and (
      lower(coalesce(i.item_code, '')) like '%cbc%'
      or lower(coalesce(i.item_name, '')) like '%cbc%'
      or lower(coalesce(i.item_name, '')) like '%complete blood count%'
    )))
  order by i.item_name;
end;
$;
revoke all on function public.staff_requestable_items(public.request_type) from public, anon;
grant execute on function public.staff_requestable_items(public.request_type) to authenticated;

commit;
