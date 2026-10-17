-- HMS Step 7: request payment, department inventory and fulfillment.
-- Every mutation is role-guarded in PostgreSQL; inventory/profit side effects remain owned by existing database guards.
alter table public.bills
  add column if not exists request_id uuid references public.requests(id) on delete restrict;
create unique index if not exists bills_request_id_unique on public.bills(request_id) where request_id is not null;

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
      r.type, r.status, r.lab_result, r.created_at, w.name::text,
      coalesce((select sum(ri.quantity * ri.unit_price) from public.request_items ri where ri.request_id=r.id),0)::numeric,
      coalesce((select jsonb_agg(jsonb_build_object(
        'id',ri.id,'inventory_item_id',ri.inventory_item_id,'description',ri.description,
        'quantity',ri.quantity,'unit_price',ri.unit_price,'unit_cost',ri.unit_cost
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

create or replace function public.staff_inventory_items(p_department public.request_type)
returns table (
  id uuid, department public.request_type, item_name text, item_code text, unit text,
  quantity_on_hand integer, unit_price numeric, unit_cost numeric, low_stock_threshold integer, is_active boolean
)
language plpgsql security definer set search_path = ''
as $$
declare v_role public.staff_role; v_active boolean;
begin
  select sp.role, sp.is_active into v_role, v_active from public.staff_profiles sp where sp.user_id=auth.uid();
  if auth.uid() is null or coalesce(v_active,false) is not true then raise exception using errcode='42501', message='Active staff access is required.'; end if;
  if (v_role='pharmacy' and p_department<>'medicine') or (v_role='lab' and p_department<>'lab') or v_role not in ('pharmacy','lab') then
    raise exception using errcode='42501', message='You can only access your department inventory.';
  end if;
  return query select i.id,i.department,i.item_name,i.item_code,i.unit,i.quantity_on_hand,i.unit_price,i.unit_cost,i.low_stock_threshold,i.is_active
    from public.inventory_items i where i.department=p_department order by i.item_name;
end;
$$;
revoke all on function public.staff_inventory_items(public.request_type) from public, anon;
grant execute on function public.staff_inventory_items(public.request_type) to authenticated;

create or replace function public.inventory_save_item(
  p_department public.request_type, p_item_name text, p_item_code text, p_unit text,
  p_quantity_on_hand integer, p_unit_price numeric, p_unit_cost numeric,
  p_low_stock_threshold integer, p_item_id uuid default null
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare v_role public.staff_role; v_active boolean; v_id uuid;
begin
  select sp.role, sp.is_active into v_role, v_active from public.staff_profiles sp where sp.user_id=auth.uid();
  if auth.uid() is null or coalesce(v_active,false) is not true then raise exception using errcode='42501', message='Active staff access is required.'; end if;
  if (v_role='pharmacy' and p_department<>'medicine') or (v_role='lab' and p_department<>'lab') or v_role not in ('pharmacy','lab') then
    raise exception using errcode='42501', message='You can only manage your department inventory.';
  end if;
  if nullif(trim(p_item_name),'') is null or nullif(trim(p_item_code),'') is null or nullif(trim(p_unit),'') is null
     or p_quantity_on_hand<0 or p_unit_price<0 or p_unit_cost<0 or p_low_stock_threshold<0 then
    raise exception using errcode='22023', message='Enter a name, code, unit, and non-negative stock and price values.';
  end if;
  if p_item_id is null then
    insert into public.inventory_items(department,item_name,item_code,unit,quantity_on_hand,unit_price,unit_cost,low_stock_threshold,created_by)
    values(p_department,trim(p_item_name),trim(p_item_code),trim(p_unit),p_quantity_on_hand,p_unit_price,p_unit_cost,p_low_stock_threshold,auth.uid())
    returning id into v_id;
  else
    update public.inventory_items set item_name=trim(p_item_name), item_code=trim(p_item_code), unit=trim(p_unit),
      quantity_on_hand=p_quantity_on_hand, unit_price=p_unit_price, unit_cost=p_unit_cost,
      low_stock_threshold=p_low_stock_threshold, updated_at=now()
      where id=p_item_id and department=p_department returning id into v_id;
    if v_id is null then raise exception using errcode='P0002', message='Inventory item not found in your department.'; end if;
  end if;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,details)
  values(auth.uid(),case when p_item_id is null then 'inventory_item_created' else 'inventory_item_updated' end,'inventory_item',v_id::text,
    jsonb_build_object('department',p_department,'item_code',trim(p_item_code),'quantity_on_hand',p_quantity_on_hand));
  return v_id;
end;
$$;
revoke all on function public.inventory_save_item(public.request_type,text,text,text,integer,numeric,numeric,integer,uuid) from public, anon;
grant execute on function public.inventory_save_item(public.request_type,text,text,text,integer,numeric,numeric,integer,uuid) to authenticated;

create or replace function public.create_hms_request(
  p_patient_id uuid, p_encounter_id uuid, p_type public.request_type, p_items jsonb
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare v_role public.staff_role; v_active boolean; v_ward uuid; v_request uuid; v_encounter_patient uuid;
  v_item jsonb; v_inventory public.inventory_items%rowtype; v_qty integer; v_count integer:=0;
begin
  select sp.role,sp.is_active,sp.ward_id into v_role,v_active,v_ward from public.staff_profiles sp where sp.user_id=auth.uid();
  if auth.uid() is null or coalesce(v_active,false) is not true then raise exception using errcode='42501', message='Active staff access is required.'; end if;
  if v_role not in ('emergency_nurse','nurse_station') then raise exception using errcode='42501', message='Only the Emergency Nurse or assigned Nurse Station can create requests.'; end if;
  if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception using errcode='22023', message='Add at least one inventory item.'; end if;
  select e.patient_id into v_encounter_patient from public.encounters e where e.id=p_encounter_id and e.status='open';
  if v_encounter_patient is null or v_encounter_patient<>p_patient_id then raise exception using errcode='22023', message='Select an open encounter for this patient.'; end if;
  if v_role='nurse_station' and not exists(select 1 from public.patients p where p.id=p_patient_id and p.current_ward_id=v_ward and v_ward is not null) then
    raise exception using errcode='42501', message='You can only request items for patients assigned to your ward.';
  end if;
  insert into public.requests(patient_id,encounter_id,created_by,ward_id,type,status)
    select p.id,p_encounter_id,auth.uid(),p.current_ward_id,p_type,'pending_payment'::public.request_status
    from public.patients p where p.id=p_patient_id
    returning id into v_request;
  if v_request is null then raise exception using errcode='P0002', message='Patient not found.'; end if;
  for v_item in select value from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'quantity')::integer;
    if v_qty is null or v_qty<1 then raise exception using errcode='22023', message='Quantity must be at least one.'; end if;
    select * into v_inventory from public.inventory_items i
      where i.id=(v_item->>'inventory_item_id')::uuid and i.department=p_type and i.is_active=true;
    if not found then raise exception using errcode='22023', message='An item is unavailable in the selected department.'; end if;
    if v_inventory.quantity_on_hand<v_qty then raise exception using errcode='22023', message='Requested quantity exceeds available stock.'; end if;
    insert into public.request_items(request_id,inventory_item_id,description,quantity,unit_price,unit_cost)
      values(v_request,v_inventory.id,v_inventory.item_name,v_qty,v_inventory.unit_price,v_inventory.unit_cost);
    v_count:=v_count+1;
  end loop;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,details)
    values(auth.uid(),'request_created','request',v_request::text,jsonb_build_object('patient_id',p_patient_id,'type',p_type,'item_count',v_count));
  return v_request;
end;
$$;
revoke all on function public.create_hms_request(uuid,uuid,public.request_type,jsonb) from public, anon;
grant execute on function public.create_hms_request(uuid,uuid,public.request_type,jsonb) to authenticated;

create or replace function public.cashier_pay_hms_request(p_request_id uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare v_role public.staff_role; v_active boolean; v_request public.requests%rowtype; v_subtotal numeric(12,2); v_bill uuid;
begin
  select sp.role,sp.is_active into v_role,v_active from public.staff_profiles sp where sp.user_id=auth.uid();
  if auth.uid() is null or coalesce(v_active,false) is not true or v_role<>'cashier' then raise exception using errcode='42501', message='Only an active Cashier can record request payments.'; end if;
  select * into v_request from public.requests where id=p_request_id for update;
  if not found then raise exception using errcode='P0002', message='Request not found.'; end if;
  if v_request.status<>'pending_payment' then raise exception using errcode='22023', message='This request is not awaiting payment.'; end if;
  select coalesce(sum(ri.quantity*ri.unit_price),0)::numeric(12,2) into v_subtotal from public.request_items ri where ri.request_id=p_request_id;
  if v_subtotal<=0 then raise exception using errcode='22023', message='This request has no payable items.'; end if;
  insert into public.bills(patient_id,encounter_id,request_id,subtotal,discount_category,discount_amount,total_bill,is_final,paid_at,paid_by)
    values(v_request.patient_id,v_request.encounter_id,p_request_id,v_subtotal,'none',0,v_subtotal,false,now(),auth.uid())
    returning id into v_bill;
  update public.requests set status='paid',paid_at=now(),paid_by=auth.uid(),updated_at=now() where id=p_request_id;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,details)
    values(auth.uid(),'request_payment_recorded','request',p_request_id::text,jsonb_build_object('bill_id',v_bill,'amount',v_subtotal));
  return v_bill;
end;
$$;
revoke all on function public.cashier_pay_hms_request(uuid) from public, anon;
grant execute on function public.cashier_pay_hms_request(uuid) to authenticated;

create or replace function public.fulfill_hms_request(p_request_id uuid, p_lab_result text default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare v_role public.staff_role; v_active boolean; v_request public.requests%rowtype;
begin
  select sp.role,sp.is_active into v_role,v_active from public.staff_profiles sp where sp.user_id=auth.uid();
  if auth.uid() is null or coalesce(v_active,false) is not true then raise exception using errcode='42501', message='Active staff access is required.'; end if;
  select * into v_request from public.requests where id=p_request_id for update;
  if not found then raise exception using errcode='P0002', message='Request not found.'; end if;
  if (v_request.type='medicine' and v_role<>'pharmacy') or (v_request.type='lab' and v_role<>'lab') then
    raise exception using errcode='42501', message='Only the assigned department can fulfill this request.';
  end if;
  if v_request.status<>'paid' then raise exception using errcode='22023', message='Cashier payment is required before fulfillment.'; end if;
  if v_request.type='lab' and nullif(trim(p_lab_result),'') is null then raise exception using errcode='22023', message='Enter the lab result before releasing this request.'; end if;
  update public.requests set status='released',lab_result=case when v_request.type='lab' then trim(p_lab_result) else null end,
    fulfilled_at=now(),fulfilled_by=auth.uid(),updated_at=now() where id=p_request_id;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,details)
    values(auth.uid(),'request_fulfilled','request',p_request_id::text,jsonb_build_object('type',v_request.type,'lab_result_saved',v_request.type='lab'));
  return p_request_id;
end;
$$;
revoke all on function public.fulfill_hms_request(uuid,text) from public, anon;
grant execute on function public.fulfill_hms_request(uuid,text) to authenticated;
