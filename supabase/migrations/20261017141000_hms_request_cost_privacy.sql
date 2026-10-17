-- Do not expose per-request inventory cost basis in the request queue.
-- Department staff can view their own inventory cost through the inventory workspace;
-- request processing only needs the item description, quantity and sale price.
create or replace function public.staff_request_workspace()
returns table (
  request_id uuid, patient_id uuid, encounter_id uuid, patient_number text, patient_name text,
  request_type public.request_type, status public.request_status, lab_result text, created_at timestamptz,
  ward_name text, total numeric, items jsonb, bill_paid boolean
)
language plpgsql security definer set search_path = ''
as $$
declare v_role public.staff_role; v_active boolean; v_ward uuid;
begin
  select sp.role, sp.is_active, sp.ward_id into v_role, v_active, v_ward
  from public.staff_profiles sp where sp.user_id = auth.uid();
  if auth.uid() is null or coalesce(v_active,false) is not true then
    raise exception using errcode='42501', message='Active staff access is required.';
  end if;
  if v_role not in ('emergency_nurse','cashier','pharmacy','lab','nurse_station') then
    raise exception using errcode='42501', message='Your staff role cannot view request queues.';
  end if;
  return query
    select r.id, r.patient_id, r.encounter_id, p.patient_number,
      trim(p.first_name || ' ' || coalesce(p.middle_name || ' ', '') || p.last_name),
      r.type, r.status,
      case
        when v_role in ('lab'::public.staff_role, 'emergency_nurse'::public.staff_role)
          or (v_role = 'nurse_station'::public.staff_role and v_ward is not null and p.current_ward_id = v_ward)
        then r.lab_result
        else null
      end,
      r.created_at, w.name::text,
      coalesce((select sum(ri.quantity * ri.unit_price) from public.request_items ri where ri.request_id=r.id),0)::numeric,
      coalesce((select jsonb_agg(jsonb_build_object(
        'id',ri.id,'inventory_item_id',ri.inventory_item_id,'description',ri.description,
        'quantity',ri.quantity,'unit_price',ri.unit_price,'unit_cost',null
      ) order by ri.created_at) from public.request_items ri where ri.request_id=r.id),'[]'::jsonb),
      exists(select 1 from public.bills b where b.request_id=r.id and b.paid_at is not null)
    from public.requests r
    join public.patients p on p.id=r.patient_id
    left join public.wards w on w.id=r.ward_id
    where
      (v_role not in ('pharmacy','lab') or r.type = case when v_role='pharmacy' then 'medicine'::public.request_type else 'lab'::public.request_type end)
      and (v_role <> 'nurse_station' or (v_ward is not null and p.current_ward_id=v_ward))
    order by r.created_at desc;
end;
$$;
revoke all on function public.staff_request_workspace() from public, anon;
grant execute on function public.staff_request_workspace() to authenticated;
