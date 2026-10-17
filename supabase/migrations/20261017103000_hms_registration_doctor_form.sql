-- Step 6: guarded patient registration, doctor catalog editing, and Emergency Nurse encounter form.
-- Clinical mutations stay behind role-checked RPCs because base-table writes are revoked.
begin;
create sequence if not exists public.hms_patient_number_seq;
create or replace function public.info_officer_register_patient(p_first_name text,p_last_name text,p_date_of_birth date,p_sex text,p_middle_name text default null,p_phone text default null,p_address text default null,p_pwd_or_senior boolean default false)
returns table (patient_id uuid, patient_number text) language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v_role public.staff_role; v_patient_id uuid; v_patient_number text;
begin
 select sp.role into v_role from public.staff_profiles sp where sp.user_id=v_actor and sp.is_active=true;
 if v_actor is null or v_role is distinct from 'info_officer'::public.staff_role then raise exception using errcode='42501',message='Only an active Information Officer can register patients.'; end if;
 if nullif(trim(p_first_name),'') is null or nullif(trim(p_last_name),'') is null then raise exception using errcode='22023',message='Enter the patient first and last name.'; end if;
 if p_date_of_birth is null or p_date_of_birth>current_date then raise exception using errcode='22023',message='Enter a valid date of birth.'; end if;
 if p_sex not in ('female','male','other','unknown') then raise exception using errcode='22023',message='Choose a valid sex value.'; end if;
 v_patient_number:='HMS-'||to_char(current_date,'YYYYMMDD')||'-'||lpad(nextval('public.hms_patient_number_seq')::text,6,'0');
 insert into public.patients(patient_number,first_name,middle_name,last_name,date_of_birth,sex,phone,address,pwd_or_senior,status,created_by)
 values(v_patient_number,trim(p_first_name),nullif(trim(p_middle_name),''),trim(p_last_name),p_date_of_birth,p_sex,nullif(trim(p_phone),''),nullif(trim(p_address),''),coalesce(p_pwd_or_senior,false),'registered'::public.patient_status,v_actor) returning id into v_patient_id;
 insert into public.audit_logs(actor_id,action,entity_type,entity_id,details) values(v_actor,'patient.registered','patient',v_patient_id::text,jsonb_build_object('patient_number',v_patient_number));
 return query select v_patient_id,v_patient_number;
end; $$;
create or replace function public.info_officer_save_doctor(p_full_name text,p_specialty text default null,p_is_on_duty boolean default false,p_fixed_fee numeric default 0,p_doctor_id uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=auth.uid(); v_role public.staff_role; v_doctor_id uuid;
begin
 select sp.role into v_role from public.staff_profiles sp where sp.user_id=v_actor and sp.is_active=true;
 if v_actor is null or v_role is distinct from 'info_officer'::public.staff_role then raise exception using errcode='42501',message='Only an active Information Officer can manage doctor records.'; end if;
 if nullif(trim(p_full_name),'') is null then raise exception using errcode='22023',message='Enter the doctor name.'; end if;
 if p_fixed_fee is null or p_fixed_fee<0 then raise exception using errcode='22023',message='Doctor fee must be zero or greater.'; end if;
 if p_doctor_id is null then
  insert into public.doctors(full_name,specialty,is_on_duty,fixed_fee,is_active,created_by) values(trim(p_full_name),nullif(trim(p_specialty),''),coalesce(p_is_on_duty,false),p_fixed_fee,true,v_actor) returning id into v_doctor_id;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,details) values(v_actor,'doctor.created','doctor',v_doctor_id::text,jsonb_build_object('full_name',trim(p_full_name),'is_on_duty',coalesce(p_is_on_duty,false)));
 else
  update public.doctors set full_name=trim(p_full_name),specialty=nullif(trim(p_specialty),''),is_on_duty=coalesce(p_is_on_duty,false),fixed_fee=p_fixed_fee,updated_at=now() where id=p_doctor_id and is_active=true returning id into v_doctor_id;
  if v_doctor_id is null then raise exception using errcode='P0002',message='That active doctor record could not be found.'; end if;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,details) values(v_actor,'doctor.updated','doctor',v_doctor_id::text,jsonb_build_object('full_name',trim(p_full_name),'is_on_duty',coalesce(p_is_on_duty,false)));
 end if;
 return v_doctor_id;
end; $$;
create or replace function public.emergency_nurse_save_encounter(p_patient_id uuid,p_findings text default null,p_recommendations text default null,p_recommendation_type text default null,p_doctor_id uuid default null,p_encounter_id uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=auth.uid(); v_role public.staff_role; v_patient_status public.patient_status; v_doctor_id uuid:=p_doctor_id; v_encounter_id uuid;
begin
 select sp.role into v_role from public.staff_profiles sp where sp.user_id=v_actor and sp.is_active=true;
 if v_actor is null or v_role is distinct from 'emergency_nurse'::public.staff_role then raise exception using errcode='42501',message='Only an active Emergency Nurse can record doctor findings.'; end if;
 if p_recommendation_type is not null and p_recommendation_type not in ('consult','lab','medicine','mixed') then raise exception using errcode='22023',message='Choose Consult, Lab, Medicine, or Mixed recommendation.'; end if;
 if p_recommendation_type is not null and nullif(trim(p_recommendations),'') is null then raise exception using errcode='22023',message='Enter the recommendation details.'; end if;
 select p.status into v_patient_status from public.patients p where p.id=p_patient_id;
 if v_patient_status is null then raise exception using errcode='P0002',message='Patient record not found.'; end if;
 if v_patient_status not in ('registered'::public.patient_status,'in_emergency'::public.patient_status) then raise exception using errcode='22023',message='Only a newly registered or emergency patient can receive an encounter form.'; end if;
 if v_doctor_id is not null then
  if not exists(select 1 from public.doctors d where d.id=v_doctor_id and d.is_active=true) then raise exception using errcode='22023',message='Choose an active doctor record.'; end if;
 else
  select d.id into v_doctor_id from public.doctors d where d.is_active=true and d.is_on_duty=true order by d.full_name limit 1;
 end if;
 if p_encounter_id is not null then
  update public.encounters set doctor_id=v_doctor_id,findings=nullif(trim(p_findings),''),recommendations=nullif(trim(p_recommendations),''),recommendation_type=p_recommendation_type,updated_at=now()
  where id=p_encounter_id and patient_id=p_patient_id and created_by=v_actor and status='open' returning id into v_encounter_id;
  if v_encounter_id is null then raise exception using errcode='42501',message='That open encounter is not available for editing.'; end if;
 else
  if exists(select 1 from public.encounters e where e.patient_id=p_patient_id and e.status='open') then raise exception using errcode='23505',message='This patient already has an open encounter. Open it from the encounter queue to update the form.'; end if;
  insert into public.encounters(patient_id,doctor_id,created_by,findings,recommendations,recommendation_type,status)
  values(p_patient_id,v_doctor_id,v_actor,nullif(trim(p_findings),''),nullif(trim(p_recommendations),''),p_recommendation_type,'open') returning id into v_encounter_id;
  update public.patients set status='in_emergency'::public.patient_status,updated_at=now() where id=p_patient_id and status='registered'::public.patient_status;
 end if;
 insert into public.audit_logs(actor_id,action,entity_type,entity_id,details) values(v_actor,case when p_encounter_id is null then 'encounter.created' else 'encounter.updated' end,'encounter',v_encounter_id::text,jsonb_build_object('patient_id',p_patient_id,'doctor_id',v_doctor_id,'recommendation_type',p_recommendation_type));
 return v_encounter_id;
end; $$;
revoke all on function public.info_officer_register_patient(text,text,date,text,text,text,text,boolean) from public,anon;
revoke all on function public.info_officer_save_doctor(text,text,boolean,numeric,uuid) from public,anon;
revoke all on function public.emergency_nurse_save_encounter(uuid,text,text,text,uuid,uuid) from public,anon;
grant execute on function public.info_officer_register_patient(text,text,date,text,text,text,text,boolean) to authenticated;
grant execute on function public.info_officer_save_doctor(text,text,boolean,numeric,uuid) to authenticated;
grant execute on function public.emergency_nurse_save_encounter(uuid,text,text,text,uuid,uuid) to authenticated;
commit;