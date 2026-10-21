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

commit;
