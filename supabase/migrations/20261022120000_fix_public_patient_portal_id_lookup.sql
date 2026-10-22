-- Public returning-patient portal ID verification and ID-number propagation.
begin;

create or replace function public.info_officer_review_patient_submission(p_submission_id uuid, p_approve boolean)
returns table(submission_id uuid, submission_status text, patient_id uuid, patient_number text)
language plpgsql security definer set search_path = ''
as $function$
declare
 v_actor uuid := auth.uid(); v_role public.staff_role;
 v_submission public.patient_registration_submissions%rowtype;
 v_patient_id uuid; v_patient_number text; v_status text;
begin
 select sp.role into v_role from public.staff_profiles sp where sp.user_id = v_actor and sp.is_active = true;
 if v_actor is null or v_role is distinct from 'info_officer'::public.staff_role then
  raise exception using errcode = '42501', message = 'Only an active Information Officer can review patient submissions.';
 end if;
 select s.* into v_submission from public.patient_registration_submissions s where s.id = p_submission_id for update;
 if not found then raise exception using errcode = 'P0002', message = 'Patient submission was not found.'; end if;
 if v_submission.status <> 'pending' then raise exception using errcode = '22023', message = 'This patient submission has already been reviewed.'; end if;
 if p_approve then
  v_patient_number := 'HMS-' || to_char(current_date, 'YYYYMMDD') || '-' || lpad(nextval('public.hms_patient_number_seq')::text, 6, '0');
  insert into public.patients(patient_number, first_name, middle_name, last_name, date_of_birth, sex, phone, address, pwd_or_senior, id_number, status, created_by)
  values(v_patient_number, trim(v_submission.first_name), nullif(trim(v_submission.middle_name), ''), trim(v_submission.last_name), v_submission.date_of_birth, v_submission.sex, nullif(trim(v_submission.phone), ''), nullif(trim(v_submission.address), ''), v_submission.pwd_or_senior, nullif(trim(v_submission.id_number), ''), 'registered'::public.patient_status, v_actor)
  returning id into v_patient_id;
  v_status := 'approved';
  update public.patient_registration_submissions set status = v_status, reviewed_at = now(), reviewed_by = v_actor, patient_id = v_patient_id where id = p_submission_id;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, details)
  values(v_actor, 'patient.registered_from_qr', 'patient', v_patient_id::text, jsonb_build_object('patient_number', v_patient_number, 'submission_id', p_submission_id));
 else
  v_status := 'rejected';
  update public.patient_registration_submissions set status = v_status, reviewed_at = now(), reviewed_by = v_actor where id = p_submission_id;
 end if;
 insert into public.audit_logs(actor_id, action, entity_type, entity_id, details)
 values(v_actor, 'patient.registration_submission_reviewed', 'patient_registration_submission', p_submission_id::text, jsonb_build_object('status', v_status));
 return query select p_submission_id, v_status, v_patient_id, v_patient_number;
end;
$function$;

create or replace function public.public_patient_portal_bill_lookup(
 p_patient_number text,
 p_date_of_birth date default null,
 p_phone text default null,
 p_encounter_id uuid default null,
 p_id_number text default null
)
returns table (
 patient_number text, patient_name text, encounter_id uuid, encounter_status text,
 bill_id uuid, subtotal numeric, discount_label text, discount_amount numeric,
 total_bill numeric, paid_at timestamptz, last_updated timestamptz
)
language plpgsql security definer set search_path = ''
as $function$
begin
 if nullif(trim(p_patient_number), '') is null then return; end if;
 if p_id_number is not null and length(trim(p_id_number)) > 0 then
  return query
  select p.patient_number, trim(p.first_name || ' ' || coalesce(p.middle_name || ' ', '') || p.last_name),
   e.id, e.status, b.id, coalesce(b.subtotal,0),
   case when b.discount_label is not null and b.discount_label <> 'none' then b.discount_label
    when b.discount_category = 'philhealth'::public.discount_type then 'philhealth'
    when b.discount_category = 'pwd_senior'::public.discount_type then 'pwd/senior' else 'none' end,
   coalesce(b.discount_amount,0), coalesce(b.total_bill,0), b.paid_at,
   greatest(coalesce(b.updated_at,e.updated_at),e.updated_at)
  from public.patients p join public.encounters e on e.patient_id=p.id
  left join lateral (select bx.* from public.bills bx where bx.encounter_id=e.id order by bx.is_final desc,bx.created_at desc limit 1) b on true
  where upper(p.patient_number)=upper(trim(p_patient_number))
   and nullif(trim(p.id_number),'') is not null
   and upper(regexp_replace(p.id_number,'[^A-Z0-9]','','gi'))=upper(regexp_replace(trim(p_id_number),'[^A-Z0-9]','','gi'))
   and (p_encounter_id is null or e.id=p_encounter_id)
  order by e.created_at desc limit 1;
  return;
 end if;
 if p_date_of_birth is null or p_date_of_birth > current_date or p_phone is null
  or length(regexp_replace(p_phone,'[^0-9]','','g')) < 7 then return; end if;
 return query
 select p.patient_number, trim(p.first_name || ' ' || coalesce(p.middle_name || ' ', '') || p.last_name),
  e.id, e.status, b.id, coalesce(b.subtotal,0),
  case when b.discount_label is not null and b.discount_label <> 'none' then b.discount_label
   when b.discount_category = 'philhealth'::public.discount_type then 'philhealth'
   when b.discount_category = 'pwd_senior'::public.discount_type then 'pwd/senior' else 'none' end,
  coalesce(b.discount_amount,0), coalesce(b.total_bill,0), b.paid_at,
  greatest(coalesce(b.updated_at,e.updated_at),e.updated_at)
 from public.patients p join public.encounters e on e.patient_id=p.id
 left join lateral (select bx.* from public.bills bx where bx.encounter_id=e.id order by bx.is_final desc,bx.created_at desc limit 1) b on true
 where upper(p.patient_number)=upper(trim(p_patient_number))
  and p.date_of_birth=p_date_of_birth
  and regexp_replace(coalesce(p.phone,''),'[^0-9]','','g')=regexp_replace(p_phone,'[^0-9]','','g')
  and (p_encounter_id is null or e.id=p_encounter_id)
 order by e.created_at desc limit 1;
end;
$function$;
revoke all on function public.public_patient_portal_bill_lookup(text,date,text,uuid,text) from public;
grant execute on function public.public_patient_portal_bill_lookup(text,date,text,uuid,text) to anon, authenticated;

commit;
