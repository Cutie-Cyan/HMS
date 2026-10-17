-- Serialize final-bill payment with encounter changes and discharge.
-- Use the same encounter -> bill lock order as billing preparation/discharge
-- to avoid lock-order inversions during concurrent closeout operations.
CREATE OR REPLACE FUNCTION public.cashier_pay_final_bill(p_bill_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 v_actor uuid:=auth.uid();
 v_role public.staff_role;
 v_active boolean;
 v_encounter_id uuid;
 v_enc public.encounters%rowtype;
 v_bill public.bills%rowtype;
begin
 select sp.role,sp.is_active into v_role,v_active
 from public.staff_profiles sp where sp.user_id=v_actor;

 if v_actor is null or coalesce(v_active,false) is not true
    or v_role is distinct from 'cashier'::public.staff_role then
  raise exception using errcode='42501',message='Only an active Cashier can record final-bill payment.';
 end if;

 -- Read the parent ID first without locking the bill, then acquire locks in
 -- encounter -> bill order, consistent with final-bill preparation/discharge.
 select b.encounter_id into v_encounter_id
 from public.bills b
 where b.id=p_bill_id and b.is_final=true;

 if not found then
  raise exception using errcode='P0002',message='Final bill not found.';
 end if;

 select * into v_enc
 from public.encounters e
 where e.id=v_encounter_id
 for update;

 if not found or v_enc.status <> 'awaiting_discharge' or v_enc.bed_id is null then
  raise exception using errcode='22023',message='Encounter must be awaiting discharge before final payment.';
 end if;

 select * into v_bill
 from public.bills b
 where b.id=p_bill_id and b.encounter_id=v_enc.id and b.is_final=true
 for update;

 if not found then
  raise exception using errcode='P0002',message='Final bill not found for this encounter.';
 end if;

 if v_bill.paid_at is not null then
  raise exception using errcode='22023',message='Final bill has already been paid.';
 end if;

 if exists(
   select 1 from public.requests r
   where r.encounter_id=v_enc.id
     and r.status not in ('released'::public.request_status,'cancelled'::public.request_status)
 ) or exists(
   select 1 from public.requests r
   where r.encounter_id=v_enc.id
     and r.status <> 'cancelled'::public.request_status
     and not exists(
       select 1 from public.bills rb
       where rb.request_id=r.id and rb.paid_at is not null
     )
 ) then
  raise exception using errcode='22023',message='Requests must be fulfilled and all request charges paid before final payment.';
 end if;

 update public.bills
 set paid_at=now(),paid_by=v_actor,updated_at=now()
 where id=p_bill_id;

 insert into public.audit_logs(actor_id,action,entity_type,entity_id,details)
 values(v_actor,'final_bill_paid','bill',p_bill_id::text,
   jsonb_build_object('encounter_id',v_enc.id,'amount',v_bill.total_bill));

 return p_bill_id;
end;
$function$;

revoke all on function public.cashier_pay_final_bill(uuid) from public,anon;
grant execute on function public.cashier_pay_final_bill(uuid) to authenticated;
