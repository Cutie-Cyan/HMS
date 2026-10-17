-- HMS foundational schema and administrative ward/bed configuration.
-- New empty project baseline verified 2026-10-17. No clinical/demo records are seeded.
begin;

create extension if not exists pgcrypto;

create type public.staff_role as enum (
  'admin', 'info_officer', 'emergency_nurse', 'cashier', 'pharmacy', 'lab', 'nurse_station'
);
create type public.ward_name as enum ('Emergency Room', 'Female Ward', 'Male Ward', 'Pedia Ward');
create type public.bed_type as enum ('public', 'private');
create type public.patient_status as enum (
  'registered', 'in_emergency', 'admitted', 'awaiting_discharge', 'discharged', 'outpatient'
);
create type public.request_type as enum ('medicine', 'lab');
create type public.request_status as enum (
  'pending_payment', 'paid', 'in_progress', 'completed', 'released', 'cancelled'
);
create type public.discount_type as enum ('none', 'philhealth', 'pwd_senior');

create table public.staff_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null,
  role public.staff_role not null,
  ward_id uuid,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nurse_station_requires_ward check (role = 'nurse_station' or ward_id is null)
);

create table public.wards (
  id uuid primary key default gen_random_uuid(),
  name public.ward_name not null unique,
  public_daily_rate numeric(12,2) not null default 800 check (public_daily_rate >= 0),
  private_daily_rate numeric(12,2) not null default 5000 check (private_daily_rate >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.staff_profiles
  add constraint staff_profiles_ward_fk foreign key (ward_id) references public.wards(id) on delete restrict;

create table public.doctors (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (length(trim(full_name)) > 0),
  specialty text,
  is_on_duty boolean not null default false,
  fixed_fee numeric(12,2) not null default 0 check (fixed_fee >= 0),
  is_active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  room_code text not null unique check (length(trim(room_code)) > 0),
  ward_id uuid references public.wards(id) on delete restrict,
  is_private boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.beds (
  id uuid primary key default gen_random_uuid(),
  ward_id uuid not null references public.wards(id) on delete restrict,
  room_id uuid references public.rooms(id) on delete restrict,
  bed_code text not null unique check (length(trim(bed_code)) > 0),
  type public.bed_type not null default 'public',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint private_bed_requires_room check (type <> 'private' or room_id is not null)
);

create table public.patients (
  id uuid primary key default gen_random_uuid(),
  patient_number text not null unique,
  first_name text not null,
  middle_name text,
  last_name text not null,
  date_of_birth date not null,
  sex text not null check (sex in ('female','male','other','unknown')),
  phone text,
  address text,
  pwd_or_senior boolean not null default false,
  status public.patient_status not null default 'registered',
  current_ward_id uuid references public.wards(id) on delete restrict,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.encounters (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete restrict,
  doctor_id uuid references public.doctors(id) on delete restrict,
  created_by uuid not null references auth.users(id) on delete restrict,
  findings text,
  recommendations text,
  recommendation_type text check (recommendation_type in ('consult','lab','medicine','mixed')),
  admitted_at timestamptz,
  discharged_at timestamptz,
  bed_id uuid references public.beds(id) on delete restrict,
  status text not null default 'open' check (status in ('open','awaiting_discharge','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  department public.request_type not null,
  item_name text not null check (length(trim(item_name)) > 0),
  item_code text not null,
  unit text not null default 'unit',
  quantity_on_hand integer not null default 0 check (quantity_on_hand >= 0),
  unit_price numeric(12,2) not null default 0 check (unit_price >= 0),
  unit_cost numeric(12,2) not null default 0 check (unit_cost >= 0),
  low_stock_threshold integer not null default 5 check (low_stock_threshold >= 0),
  is_active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (department, item_code)
);

create table public.requests (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete restrict,
  encounter_id uuid not null references public.encounters(id) on delete restrict,
  created_by uuid not null references auth.users(id) on delete restrict,
  ward_id uuid references public.wards(id) on delete restrict,
  type public.request_type not null,
  status public.request_status not null default 'pending_payment',
  lab_result text,
  paid_at timestamptz,
  paid_by uuid references auth.users(id) on delete restrict,
  fulfilled_at timestamptz,
  fulfilled_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lab_result_required_before_release check (status <> 'released' or type <> 'lab' or nullif(trim(lab_result), '') is not null)
);

create table public.request_items (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete restrict,
  inventory_item_id uuid references public.inventory_items(id) on delete restrict,
  description text not null check (length(trim(description)) > 0),
  quantity integer not null default 1 check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  unit_cost numeric(12,2) not null default 0 check (unit_cost >= 0),
  created_at timestamptz not null default now()
);

create table public.bills (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete restrict,
  encounter_id uuid not null references public.encounters(id) on delete restrict,
  subtotal numeric(12,2) not null default 0 check (subtotal >= 0),
  discount_category public.discount_type not null default 'none',
  discount_amount numeric(12,2) not null default 0 check (discount_amount >= 0),
  total_bill numeric(12,2) not null default 0 check (total_bill >= 0),
  is_final boolean not null default false,
  paid_at timestamptz,
  paid_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bill_formula check (total_bill = greatest(0, subtotal - discount_amount))
);

create table public.profit_inventory (
  id uuid primary key default gen_random_uuid(),
  request_item_id uuid not null unique references public.request_items(id) on delete restrict,
  request_id uuid not null references public.requests(id) on delete restrict,
  department public.request_type not null,
  quantity integer not null check (quantity > 0),
  revenue numeric(12,2) not null check (revenue >= 0),
  cost numeric(12,2) not null check (cost >= 0),
  profit numeric(12,2) not null,
  recorded_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index patients_status_idx on public.patients(status);
create index patients_name_idx on public.patients(last_name, first_name);
create index encounters_patient_idx on public.encounters(patient_id, created_at desc);
create index requests_queue_idx on public.requests(type, status, created_at);
create index beds_ward_active_idx on public.beds(ward_id, is_active);
create index bills_encounter_idx on public.bills(encounter_id, created_at desc);
create index inventory_department_idx on public.inventory_items(department, is_active);

-- Ward catalog is required system configuration, not patient/demo data.
insert into public.wards (name, public_daily_rate, private_daily_rate) values
  ('Emergency Room', 800, 5000),
  ('Female Ward', 800, 5000),
  ('Male Ward', 800, 5000),
  ('Pedia Ward', 800, 5000);

create or replace function public.current_staff_role()
returns public.staff_role
language sql stable security invoker
set search_path = ''
as $$
  select sp.role
  from public.staff_profiles sp
  where sp.user_id = (select auth.uid())
    and sp.is_active = true
  limit 1
$$;

create or replace function public.current_staff_ward_id()
returns uuid
language sql stable security invoker
set search_path = ''
as $$
  select sp.ward_id
  from public.staff_profiles sp
  where sp.user_id = (select auth.uid())
    and sp.is_active = true
    and sp.role = 'nurse_station'::public.staff_role
  limit 1
$$;

create or replace function public.is_active_staff()
returns boolean
language sql stable security invoker
set search_path = ''
as $$
  select exists (
    select 1 from public.staff_profiles sp
    where sp.user_id = (select auth.uid()) and sp.is_active = true
  )
$$;

alter table public.staff_profiles enable row level security;
alter table public.wards enable row level security;
alter table public.doctors enable row level security;
alter table public.rooms enable row level security;
alter table public.beds enable row level security;
alter table public.patients enable row level security;
alter table public.encounters enable row level security;
alter table public.inventory_items enable row level security;
alter table public.requests enable row level security;
alter table public.request_items enable row level security;
alter table public.bills enable row level security;
alter table public.profit_inventory enable row level security;
alter table public.audit_logs enable row level security;

-- Profiles: staff can read only their own profile. Administrative reads/changes
-- will be exposed through guarded RPCs in the staff-management step.
create policy staff_profiles_read_self on public.staff_profiles
for select to authenticated using (user_id = (select auth.uid()));

-- Ward and bed census is shared; patient details are not exposed by this policy.
create policy wards_read_active_staff on public.wards
for select to authenticated using (public.is_active_staff() and is_active = true);
create policy rooms_read_active_staff on public.rooms
for select to authenticated using (public.is_active_staff() and is_active = true);
create policy beds_read_active_staff on public.beds
for select to authenticated using (public.is_active_staff() and is_active = true);

-- No direct writes to beds/rooms/ward rates from client. Admin-only validated
-- RPCs will be added before the admin setup UI is enabled.
create policy doctors_read_info_officer_or_nurse on public.doctors
for select to authenticated using (
  public.current_staff_role() in ('info_officer'::public.staff_role, 'emergency_nurse'::public.staff_role)
);

-- Base clinical/financial tables deliberately start with no direct policies.
-- Later feature migrations will add role-scoped RPCs/views and narrowly scoped
-- policies together; never grant broad authenticated SELECT as a shortcut.

grant usage on type public.staff_role, public.ward_name, public.bed_type,
  public.patient_status, public.request_type, public.request_status, public.discount_type to authenticated;
grant select on public.staff_profiles, public.wards, public.rooms, public.beds, public.doctors to authenticated;
revoke all on public.patients, public.encounters, public.inventory_items, public.requests,
  public.request_items, public.bills, public.profit_inventory, public.audit_logs from anon, authenticated;
revoke all on public.staff_profiles, public.wards, public.rooms, public.beds, public.doctors from anon;

commit;
