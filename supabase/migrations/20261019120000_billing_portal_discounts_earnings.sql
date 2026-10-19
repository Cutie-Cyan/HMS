-- Patient-facing live billing portal, cashier discounts, and earnings summary.
begin;

alter table public.bills
  add column if not exists discount_label text not null default 'none'
    check (discount_label in ('none', 'philhealth', 'senior', 'pwd')),
  add column if not exists discount_notes text;

create or replace function public.public_patient_portal_bill_lookup(
  p_patient_number text,
  p_date_of_birth date,
  p_encounter_id uuid default null
)
returns table (
  patient_number text,
  patient_name text,
  encounter_id uuid,
  encounter_status text,
  bill_id uuid,
  subtotal numeric,
  discount_label text,
  discount_amount numeric,
  total_bill numeric,
  paid_at timestamptz,
  last_updated timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if nullif(trim(p_patient_number), '') is null or p_date_of_birth is null then
    return;
  end if;

  return query
  select p.patient_number,
         trim(p.first_name || ' ' || coalesce(p.middle_name || ' ', '') || p.last_name),
         e.id,
         e.status,
         b.id,
         coalesce(b.subtotal, 0),
         case
           when b.discount_label is not null and b.discount_label <> 'none' then b.discount_label
           when b.discount_category = 'philhealth'::public.discount_type then 'philhealth'
           when b.discount_category = 'pwd_senior'::public.discount_type then 'pwd/senior'
           else 'none'
         end,
         coalesce(b.discount_amount, 0),
         coalesce(b.total_bill, 0),
         b.paid_at,
         greatest(coalesce(b.updated_at, e.updated_at), e.updated_at)
  from public.patients p
  join public.encounters e on e.patient_id = p.id
  left join lateral (
    select bx.*
    from public.bills bx
    where bx.encounter_id = e.id
    order by bx.is_final desc, bx.created_at desc
    limit 1
  ) b on true
  where upper(p.patient_number) = upper(trim(p_patient_number))
    and p.date_of_birth = p_date_of_birth
    and (p_encounter_id is null or e.id = p_encounter_id)
  order by e.created_at desc
  limit 1;
end;
$$;

revoke all on function public.public_patient_portal_bill_lookup(text, date, uuid) from public;
grant execute on function public.public_patient_portal_bill_lookup(text, date, uuid) to anon, authenticated;

create or replace function public.cashier_set_bill_discount(
  p_bill_id uuid,
  p_discount_label text,
  p_discount_amount numeric,
  p_notes text default null
)
returns table (bill_id uuid, subtotal numeric, discount_amount numeric, total_bill numeric, discount_label text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_role public.staff_role;
  v_patient_pwd_senior boolean;
  v_subtotal numeric(12,2);
  v_discount numeric(12,2);
  v_category public.discount_type;
begin
  select sp.role into v_role
  from public.staff_profiles sp
  where sp.user_id = v_actor and sp.is_active = true;

  if v_actor is null or (v_role is distinct from 'cashier'::public.staff_role and v_role is distinct from 'admin'::public.staff_role) then
    raise exception using errcode='42501', message='Only an active Cashier or Admin can apply billing discounts.';
  end if;
  if p_discount_label is null or p_discount_label not in ('none', 'philhealth', 'senior', 'pwd') then
    raise exception using errcode='22023', message='Choose PhilHealth, Senior, PWD, or no discount.';
  end if;
  if p_discount_amount is null or p_discount_amount < 0 then
    raise exception using errcode='22023', message='Enter a verified discount amount of zero or greater.';
  end if;

  select b.subtotal, p.pwd_or_senior
    into v_subtotal, v_patient_pwd_senior
  from public.bills b
  join public.patients p on p.id = b.patient_id
  where b.id = p_bill_id and b.is_final = true and b.paid_at is null
  for update of b;

  if not found then
    raise exception using errcode='P0002', message='Unpaid final bill not found.';
  end if;

  if p_discount_label in ('senior', 'pwd') and not coalesce(v_patient_pwd_senior, false) then
    raise exception using errcode='22023', message='Patient is not marked as eligible for a PWD/Senior discount. Verify eligibility and patient registration first.';
  end if;

  v_category := case
    when p_discount_label = 'philhealth' then 'philhealth'::public.discount_type
    when p_discount_label in ('senior', 'pwd') then 'pwd_senior'::public.discount_type
    else 'none'::public.discount_type
  end;
  v_discount := p_discount_amount;
  if p_discount_label = 'none' and v_discount <> 0 then
    raise exception using errcode='22023', message='Set the discount amount to zero when no discount is selected.';
  end if;
  if v_discount > v_subtotal then
    raise exception using errcode='22023', message='Discount cannot exceed the bill subtotal.';
  end if;

  update public.bills
  set discount_category = v_category,
      discount_label = p_discount_label,
      discount_amount = v_discount,
      total_bill = greatest(0, subtotal - v_discount),
      discount_notes = nullif(trim(p_notes), ''),
      updated_at = now()
  where id = p_bill_id;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, details)
  values (v_actor, 'billing.discount_applied', 'bill', p_bill_id::text,
    jsonb_build_object('discount_label', p_discount_label, 'discount_amount', v_discount, 'notes', nullif(trim(p_notes), '')));

  return query select b.id, b.subtotal, b.discount_amount, b.total_bill, b.discount_label
    from public.bills b where b.id = p_bill_id;
end;
$$;

revoke all on function public.cashier_set_bill_discount(uuid, text, numeric, text) from public, anon;
grant execute on function public.cashier_set_bill_discount(uuid, text, numeric, text) to authenticated;

create or replace function public.cashier_billing_earnings()
returns table (
  paid_revenue numeric,
  outstanding_bills numeric,
  bill_count bigint,
  paid_bill_count bigint,
  inventory_revenue numeric,
  inventory_cost numeric,
  inventory_profit numeric
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_role public.staff_role;
begin
  select sp.role into v_role
  from public.staff_profiles sp
  where sp.user_id = v_actor and sp.is_active = true;
  if v_actor is null or (v_role is distinct from 'cashier'::public.staff_role and v_role is distinct from 'admin'::public.staff_role) then
    raise exception using errcode='42501', message='Only an active Cashier or Admin can view hospital earnings.';
  end if;

  return query
  select
    coalesce((select sum(b.total_bill) from public.bills b where b.paid_at is not null), 0)::numeric,
    coalesce((select sum(b.total_bill) from public.bills b where b.paid_at is null), 0)::numeric,
    (select count(*) from public.bills)::bigint,
    (select count(*) from public.bills b where b.paid_at is not null)::bigint,
    coalesce((select sum(pi.revenue) from public.profit_inventory pi), 0)::numeric,
    coalesce((select sum(pi.cost) from public.profit_inventory pi), 0)::numeric,
    coalesce((select sum(pi.profit) from public.profit_inventory pi), 0)::numeric;
end;
$$;

revoke all on function public.cashier_billing_earnings() from public, anon;
grant execute on function public.cashier_billing_earnings() to authenticated;

commit;
