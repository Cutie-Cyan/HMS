-- Reject duplicate inventory lines at request creation.
-- Without this check, repeated lines can each pass the same stock check and
-- create a paid request whose combined quantity exceeds available stock.
create or replace function public.create_hms_request(
  p_patient_id uuid,
  p_encounter_id uuid,
  p_type public.request_type,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.staff_role;
  v_active boolean;
  v_ward uuid;
  v_request uuid;
  v_encounter_patient uuid;
  v_item jsonb;
  v_inventory public.inventory_items%rowtype;
  v_qty integer;
  v_count integer := 0;
begin
  select sp.role,sp.is_active,sp.ward_id
    into v_role,v_active,v_ward
  from public.staff_profiles sp
  where sp.user_id=auth.uid();

  if auth.uid() is null or coalesce(v_active,false) is not true then
    raise exception using errcode='42501',message='Active staff access is required.';
  end if;
  if v_role not in ('emergency_nurse','nurse_station') then
    raise exception using errcode='42501',message='Only the Emergency Nurse or assigned Nurse Station can create requests.';
  end if;
  if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then
    raise exception using errcode='22023',message='Add at least one inventory item.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) as item(value)
    group by item.value->>'inventory_item_id'
    having count(*) > 1
  ) then
    raise exception using errcode='22023',message='Each inventory item can appear only once; combine duplicate quantities into one line.';
  end if;

  select e.patient_id into v_encounter_patient
  from public.encounters e
  where e.id=p_encounter_id and e.status='open';
  if v_encounter_patient is null or v_encounter_patient<>p_patient_id then
    raise exception using errcode='22023',message='Select an open encounter for this patient.';
  end if;
  if v_role='nurse_station' and not exists(
    select 1 from public.patients p
    where p.id=p_patient_id and p.current_ward_id=v_ward and v_ward is not null
  ) then
    raise exception using errcode='42501',message='You can only request items for patients assigned to your ward.';
  end if;

  insert into public.requests(patient_id,encounter_id,created_by,ward_id,type,status)
    select p.id,p_encounter_id,auth.uid(),p.current_ward_id,p_type,'pending_payment'::public.request_status
    from public.patients p where p.id=p_patient_id
    returning id into v_request;
  if v_request is null then
    raise exception using errcode='P0002',message='Patient not found.';
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_qty := (v_item->>'quantity')::integer;
    if v_qty is null or v_qty<1 then
      raise exception using errcode='22023',message='Quantity must be at least one.';
    end if;

    select * into v_inventory
    from public.inventory_items i
    where i.id=(v_item->>'inventory_item_id')::uuid
      and i.department=p_type and i.is_active=true;
    if not found then
      raise exception using errcode='22023',message='An item is unavailable in the selected department.';
    end if;
    if v_inventory.quantity_on_hand<v_qty then
      raise exception using errcode='22023',message='Requested quantity exceeds available stock.';
    end if;

    insert into public.request_items(request_id,inventory_item_id,description,quantity,unit_price,unit_cost)
    values(v_request,v_inventory.id,v_inventory.item_name,v_qty,v_inventory.unit_price,v_inventory.unit_cost);
    v_count:=v_count+1;
  end loop;

  insert into public.audit_logs(actor_id,action,entity_type,entity_id,details)
  values(auth.uid(),'request_created','request',v_request::text,
         jsonb_build_object('patient_id',p_patient_id,'type',p_type,'item_count',v_count));
  return v_request;
end;
$$;

revoke all on function public.create_hms_request(uuid,uuid,public.request_type,jsonb) from public,anon;
grant execute on function public.create_hms_request(uuid,uuid,public.request_type,jsonb) to authenticated;
