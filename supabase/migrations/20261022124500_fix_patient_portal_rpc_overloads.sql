-- Remove obsolete RPC overloads so PostgREST resolves named portal arguments unambiguously.
begin;
drop function if exists public.public_patient_portal_lookup(text,date,text);
drop function if exists public.public_patient_portal_bill_lookup(text,date,text,uuid);

create or replace function public.public_patient_portal_lookup(
 p_patient_number text,
 p_date_of_birth date default null,
 p_phone text default null,
 p_id_number text default null
)
returns table(patient_number text,first_name text,middle_name text,last_name text,date_of_birth date,sex text,status text,created_at timestamptz,last_visit_at timestamptz)
language plpgsql security definer set search_path = ''
as $function$
begin
 if nullif(trim(p_patient_number),'') is null then return; end if;
 if p_id_number is not null and length(trim(p_id_number))>0 then
  return query select p.patient_number,p.first_name,p.middle_name,p.last_name,p.date_of_birth,p.sex,p.status::text,p.created_at,
   (select max(e.created_at) from public.encounters e where e.patient_id=p.id)
  from public.patients p
  where upper(p.patient_number)=upper(trim(p_patient_number))
   and nullif(trim(p.id_number),'') is not null
   and upper(regexp_replace(p.id_number,'[^A-Z0-9]','','gi'))=upper(regexp_replace(trim(p_id_number),'[^A-Z0-9]','','gi'))
  limit 1;
  return;
 end if;
 if p_date_of_birth is null or p_date_of_birth>current_date or p_phone is null or length(regexp_replace(p_phone,'[^0-9]','','g'))<7 then return; end if;
 return query select p.patient_number,p.first_name,p.middle_name,p.last_name,p.date_of_birth,p.sex,p.status::text,p.created_at,
  (select max(e.created_at) from public.encounters e where e.patient_id=p.id)
 from public.patients p
 where upper(p.patient_number)=upper(trim(p_patient_number)) and p.date_of_birth=p_date_of_birth
  and regexp_replace(coalesce(p.phone,''),'[^0-9]','','g')=regexp_replace(p_phone,'[^0-9]','','g')
 limit 1;
end;
$function$;
revoke all on function public.public_patient_portal_lookup(text,date,text,text) from public;
grant execute on function public.public_patient_portal_lookup(text,date,text,text) to anon,authenticated;
commit;
