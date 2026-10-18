alter table public.encounters add column if not exists nurse_assessment text;

create or replace function public.emergency_nurse_save_encounter_phase1_with_notes(
  p_patient_id uuid, p_doctor_id uuid default null, p_encounter_id uuid default null, p_nurse_assessment text default null
) returns uuid language plpgsql security definer set search_path = ''
as $function$
declare v_id uuid;
begin
  v_id := public.emergency_nurse_save_encounter_phase1(p_patient_id, p_doctor_id, p_encounter_id);
  update public.encounters set nurse_assessment = nullif(trim(coalesce(p_nurse_assessment, '')), ''), updated_at = now()
  where id = v_id and created_by = auth.uid() and workflow_stage = 'pending_doctor';
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'encounter.nurse_assessment_saved', 'encounter', v_id::text,
    jsonb_build_object('assessment_provided', nullif(trim(coalesce(p_nurse_assessment, '')), '') is not null));
  return v_id;
end;
$function$;

drop function if exists public.staff_encounter_queue(text);
create function public.staff_encounter_queue(p_status text default null)
returns table(
  encounter_id uuid, patient_id uuid, patient_number text, patient_name text, doctor_id uuid, doctor_name text,
  findings text, recommendations text, recommendation_type text, encounter_status text, admitted_at timestamptz,
  discharged_at timestamptz, bed_id uuid, patient_status public.patient_status, current_ward_id uuid,
  created_at timestamptz, workflow_stage text, doctor_form_returned_at timestamptz,
  findings_recorded_at timestamptz, findings_recorded_by uuid, nurse_assessment text
) language plpgsql stable security definer set search_path = ''
as $function$
declare v_actor uuid := auth.uid(); v_role public.staff_role; v_ward uuid;
begin
  select sp.role, sp.ward_id into v_role, v_ward from public.staff_profiles sp where sp.user_id = v_actor and sp.is_active = true;
  if v_actor is null or v_role is null or v_role not in ('emergency_nurse'::public.staff_role, 'nurse_station'::public.staff_role) then
    raise exception using errcode = '42501', message = 'Emergency Nurse or Nurse Station access is required.';
  end if;
  if p_status is not null and p_status not in ('open', 'awaiting_discharge', 'closed') then
    raise exception using errcode = '22023', message = 'Invalid encounter status filter.';
  end if;
  return query select e.id, p.id, p.patient_number, trim(concat_ws(' ', p.first_name, p.middle_name, p.last_name)),
    e.doctor_id, d.full_name, e.findings, e.recommendations, e.recommendation_type, e.status,
    e.admitted_at, e.discharged_at, e.bed_id, p.status, p.current_ward_id, e.created_at,
    e.workflow_stage, e.doctor_form_returned_at, e.findings_recorded_at, e.findings_recorded_by, e.nurse_assessment
  from public.encounters e join public.patients p on p.id = e.patient_id
  left join public.doctors d on d.id = e.doctor_id left join public.beds b on b.id = e.bed_id
  where (p_status is null or e.status = p_status) and (v_role = 'emergency_nurse'::public.staff_role
    or (v_role = 'nurse_station'::public.staff_role and (p.current_ward_id = v_ward or b.ward_id = v_ward)))
  order by e.created_at desc limit 100;
end;
$function$;

revoke all on function public.emergency_nurse_save_encounter_phase1_with_notes(uuid, uuid, uuid, text) from public, anon;
grant execute on function public.emergency_nurse_save_encounter_phase1_with_notes(uuid, uuid, uuid, text) to authenticated;
grant execute on function public.staff_encounter_queue(text) to authenticated;
