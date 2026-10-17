-- Ensure users without an active staff profile cannot use this privileged read RPC.
create or replace function public.staff_request_queue(p_type public.request_type default null)
returns table (request_id uuid, patient_id uuid, patient_number text, patient_name text, encounter_id uuid, request_type public.request_type, request_status public.request_status, ward_id uuid, created_at timestamptz, paid_at timestamptz, fulfilled_at timestamptz, lab_result text, items jsonb)
language plpgsql stable security definer set search_path = ''
as $$
declare v_actor uuid := auth.uid(); v_role public.staff_role; v_ward uuid;
begin
 select sp.role, sp.ward_id into v_role,v_ward from public.staff_profiles sp where sp.user_id=v_actor and sp.is_active=true;
 if v_actor is null or v_role is null or v_role not in ('emergency_nurse'::public.staff_role,'cashier'::public.staff_role,'pharmacy'::public.staff_role,'lab'::public.staff_role,'nurse_station'::public.staff_role) then raise exception using errcode='42501',message='This role cannot access the request queue.'; end if;
 if v_role='pharmacy'::public.staff_role and p_type='lab'::public.request_type then raise exception using errcode='42501',message='Pharmacy cannot access laboratory requests.'; end if;
 if v_role='lab'::public.staff_role and p_type='medicine'::public.request_type then raise exception using errcode='42501',message='Laboratory cannot access medicine requests.'; end if;
 return query select r.id,p.id,p.patient_number,trim(concat_ws(' ',p.first_name,p.middle_name,p.last_name)),r.encounter_id,r.type,r.status,r.ward_id,r.created_at,r.paid_at,r.fulfilled_at,
 case when v_role in ('lab'::public.staff_role,'nurse_station'::public.staff_role,'emergency_nurse'::public.staff_role) then r.lab_result else null::text end,coalesce(ri.items,'[]'::jsonb)
 from public.requests r join public.patients p on p.id=r.patient_id join public.encounters e on e.id=r.encounter_id
 left join lateral (select jsonb_agg(jsonb_build_object('id',i.id,'inventory_item_id',i.inventory_item_id,'description',i.description,'quantity',i.quantity,'unit_price',case when v_role='cashier'::public.staff_role then i.unit_price else null end) order by i.created_at) items from public.request_items i where i.request_id=r.id) ri on true
 where (p_type is null or r.type=p_type)
 and (v_role not in ('pharmacy'::public.staff_role,'lab'::public.staff_role) or r.type=case when v_role='pharmacy'::public.staff_role then 'medicine'::public.request_type else 'lab'::public.request_type end)
 and (v_role<>'emergency_nurse'::public.staff_role or r.created_by=v_actor or e.created_by=v_actor)
 and (v_role<>'nurse_station'::public.staff_role or r.ward_id=v_ward or p.current_ward_id=v_ward)
 order by r.created_at desc limit 200;
end;
$$;