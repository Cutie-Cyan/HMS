-- Securely store registration ID images and preserve the document reference on approval.
begin;
alter table public.patient_registration_submissions add column if not exists id_document_path text;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('patient-id-documents','patient-id-documents',false,10485760,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=false,file_size_limit=10485760,allowed_mime_types=array['image/jpeg','image/png','image/webp'];
drop policy if exists "Public can upload registration ID documents" on storage.objects;
create policy "Public can upload registration ID documents" on storage.objects for insert to anon, authenticated
with check (bucket_id='patient-id-documents' and (storage.foldername(name))[1]='pending' and array_length(storage.foldername(name),1)=2);
drop policy if exists "Information officers read patient ID documents" on storage.objects;
create policy "Information officers read patient ID documents" on storage.objects for select to authenticated
using (bucket_id='patient-id-documents' and exists(select 1 from public.staff_profiles sp where sp.user_id=auth.uid() and sp.is_active=true and sp.role='info_officer'::public.staff_role));

create or replace function public.info_officer_review_patient_submission(p_submission_id uuid, p_approve boolean)
returns table(submission_id uuid, submission_status text, patient_id uuid, patient_number text)
language plpgsql security definer set search_path = ''
as $function$
declare v_actor uuid := auth.uid(); v_role public.staff_role; v_submission public.patient_registration_submissions%rowtype; v_patient_id uuid; v_patient_number text; v_status text;
begin
 select sp.role into v_role from public.staff_profiles sp where sp.user_id=v_actor and sp.is_active=true;
 if v_actor is null or v_role is distinct from 'info_officer'::public.staff_role then raise exception using errcode='42501',message='Only an active Information Officer can review patient submissions.'; end if;
 select s.* into v_submission from public.patient_registration_submissions s where s.id=p_submission_id for update;
 if not found then raise exception using errcode='P0002',message='Patient submission was not found.'; end if;
 if v_submission.status<>'pending' then raise exception using errcode='22023',message='This patient submission has already been reviewed.'; end if;
 if p_approve then
  v_patient_number:='HMS-'||to_char(current_date,'YYYYMMDD')||'-'||lpad(nextval('public.hms_patient_number_seq')::text,6,'0');
  insert into public.patients(patient_number,first_name,middle_name,last_name,date_of_birth,sex,phone,address,pwd_or_senior,id_number,id_document_path,status,created_by)
  values(v_patient_number,trim(v_submission.first_name),nullif(trim(v_submission.middle_name),''),trim(v_submission.last_name),v_submission.date_of_birth,v_submission.sex,nullif(trim(v_submission.phone),''),nullif(trim(v_submission.address),''),v_submission.pwd_or_senior,nullif(trim(v_submission.id_number),''),v_submission.id_document_path,'registered'::public.patient_status,v_actor)
  returning id into v_patient_id;
  v_status:='approved';
  update public.patient_registration_submissions set status=v_status,reviewed_at=now(),reviewed_by=v_actor,patient_id=v_patient_id where id=p_submission_id;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,details) values(v_actor,'patient.registered_from_qr','patient',v_patient_id::text,jsonb_build_object('patient_number',v_patient_number,'submission_id',p_submission_id));
 else
  v_status:='rejected';
  update public.patient_registration_submissions set status=v_status,reviewed_at=now(),reviewed_by=v_actor where id=p_submission_id;
 end if;
 insert into public.audit_logs(actor_id,action,entity_type,entity_id,details) values(v_actor,'patient.registration_submission_reviewed','patient_registration_submission',p_submission_id::text,jsonb_build_object('status',v_status));
 return query select p_submission_id,v_status,v_patient_id,v_patient_number;
end;
$function$;
commit;
