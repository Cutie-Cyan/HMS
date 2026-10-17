-- Make request-payment retries safe when the cashier's client times out after commit.
-- The request row lock serializes retries; a previously paid request returns its existing bill.
create or replace function public.cashier_pay_hms_request(p_request_id uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_role public.staff_role;
  v_active boolean;
  v_request public.requests%rowtype;
  v_subtotal numeric(12,2);
  v_bill uuid;
begin
  select sp.role,sp.is_active into v_role,v_active
  from public.staff_profiles sp where sp.user_id=auth.uid();
  if auth.uid() is null or coalesce(v_active,false) is not true
     or v_role is distinct from 'cashier'::public.staff_role then
    raise exception using errcode='42501',message='Only an active Cashier can record request payments.';
  end if;

  select * into v_request
  from public.requests where id=p_request_id for update;
  if not found then
    raise exception using errcode='P0002',message='Request not found.';
  end if;

  if v_request.status='paid'::public.request_status then
    select b.id into v_bill
    from public.bills b
    where b.request_id=p_request_id and b.paid_at is not null;
    if v_bill is not null then return v_bill; end if;
    raise exception using errcode='22023',message='Request is marked paid but its payment record is missing. Contact an administrator.';
  end if;
  if v_request.status<>'pending_payment'::public.request_status then
    raise exception using errcode='22023',message='This request is not awaiting payment.';
  end if;

  select coalesce(sum(ri.quantity*ri.unit_price),0)::numeric(12,2)
  into v_subtotal from public.request_items ri where ri.request_id=p_request_id;
  if v_subtotal<=0 then
    raise exception using errcode='22023',message='This request has no payable items.';
  end if;

  insert into public.bills(patient_id,encounter_id,request_id,subtotal,discount_category,discount_amount,total_bill,is_final,paid_at,paid_by)
  values(v_request.patient_id,v_request.encounter_id,p_request_id,v_subtotal,'none',0,v_subtotal,false,now(),auth.uid())
  returning id into v_bill;

  update public.requests
  set status='paid',paid_at=now(),paid_by=auth.uid(),updated_at=now()
  where id=p_request_id;

  insert into public.audit_logs(actor_id,action,entity_type,entity_id,details)
  values(auth.uid(),'request_payment_recorded','request',p_request_id::text,
         jsonb_build_object('bill_id',v_bill,'amount',v_subtotal));
  return v_bill;
end;
$$;

revoke all on function public.cashier_pay_hms_request(uuid) from public,anon;
grant execute on function public.cashier_pay_hms_request(uuid) to authenticated;
