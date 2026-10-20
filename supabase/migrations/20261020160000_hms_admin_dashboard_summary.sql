-- Role-safe dashboard summary for administrators. The dashboard must not call staff-only directory RPCs as admin.
create or replace function public.admin_dashboard_summary()
returns table (
  patient_count bigint,
  active_patient_count bigint,
  open_encounter_count bigint,
  request_count bigint,
  pending_payment_count bigint,
  paid_request_count bigint,
  configured_bed_count bigint,
  occupied_bed_count bigint,
  available_bed_count bigint,
  medicine_low_stock_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role public.staff_role;
  v_active boolean;
begin
  select sp.role, sp.is_active into v_role, v_active
  from public.staff_profiles sp
  where sp.user_id = auth.uid();

  if auth.uid() is null or v_role is distinct from 'admin'::public.staff_role or coalesce(v_active, false) is not true then
    raise exception using errcode = '42501', message = 'Only an active administrator can view the dashboard summary.';
  end if;

  return query
  select
    (select count(*) from public.patients)::bigint,
    (select count(*) from public.patients p where p.status <> 'discharged'::public.patient_status)::bigint,
    (select count(*) from public.encounters e where e.status = 'open')::bigint,
    (select count(*) from public.requests r where r.status <> 'cancelled'::public.request_status)::bigint,
    (select count(*) from public.requests r where r.status = 'pending_payment'::public.request_status)::bigint,
    (select count(*) from public.requests r where r.status in ('paid'::public.request_status, 'in_progress'::public.request_status, 'completed'::public.request_status, 'released'::public.request_status))::bigint,
    (select count(*) from public.beds b where b.is_active)::bigint,
    (select count(distinct e.bed_id) from public.encounters e where e.bed_id is not null and e.status in ('open', 'awaiting_discharge'))::bigint,
    (select count(*) from public.beds b where b.is_active and not exists (
      select 1 from public.encounters e where e.bed_id = b.id and e.status in ('open', 'awaiting_discharge')
    ))::bigint,
    (select count(*) from public.inventory_items i where i.department = 'medicine'::public.request_type and i.is_active and i.quantity_on_hand <= i.low_stock_threshold)::bigint;
end;
$$;

revoke all on function public.admin_dashboard_summary() from public, anon;
grant execute on function public.admin_dashboard_summary() to authenticated;
