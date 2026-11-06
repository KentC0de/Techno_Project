-- ==============================================================================
-- PREVENTIVE MAINTENANCE SCHEDULER: SUPABASE POSTGRESQL SCHEMA & SEED
-- ==============================================================================
-- Instructions:
-- 1. Open your Supabase Project Dashboard -> SQL Editor.
-- 2. Click "New Query", paste this entire script, and click "Run".
-- ==============================================================================

-- 1. EXTENSIONS
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- 2. DROP EXISTING TABLES (IF RE-INITIALIZING)
drop table if exists task_logs cascade;
drop table if exists schedule_rules cascade;
drop table if exists equipment cascade;
drop table if exists groups cascade;
drop table if exists categories cascade;
drop table if exists profiles cascade;

-- ==============================================================================
-- 3. TABLES DEFINITION
-- ==============================================================================

-- PROFILES (Linked to Supabase Auth users)
create table profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  full_name text not null,
  role text not null check (role in ('admin', 'worker')) default 'worker',
  created_at timestamptz default now() not null
);

-- CATEGORIES (A Inverter Station Area, B PV Field Area, C MV & LV System, D Other System)
create table categories (
  id uuid default gen_random_uuid() primary key,
  code text not null unique,
  name text not null,
  sort_order int not null default 0
);

-- GROUPS (Under each category: Transformer, Inverter, PV Module Cleaning, etc.)
create table groups (
  id uuid default gen_random_uuid() primary key,
  category_id uuid references categories(id) on delete cascade not null,
  item_no int not null,
  name text not null
);

-- EQUIPMENT (Specific field equipment)
create table equipment (
  id uuid default gen_random_uuid() primary key,
  group_id uuid references groups(id) on delete cascade not null,
  name text not null,
  area text check (area in ('Area 1', 'Area 2', 'Area 3') or area is null),
  unit_count int not null default 1,
  default_freq text[] default '{}'::text[] not null,
  is_active boolean not null default true
);

-- SCHEDULE RULES (d=daily, w=weekly, M=monthly, Q=quarterly, SA=semi-annual)
create table schedule_rules (
  id uuid default gen_random_uuid() primary key,
  equipment_id uuid references equipment(id) on delete cascade not null,
  frequency text not null check (frequency in ('d', 'w', 'M', 'Q', 'SA')),
  start_date date not null,
  end_date date,
  weekday int check (weekday between 1 and 7 or weekday is null), -- 1=Mon ... 7=Sun
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now() not null
);

-- TASK LOGS (Completed, skipped, or issue records with unique constraint on rule_id + due_date)
create table task_logs (
  id uuid default gen_random_uuid() primary key,
  rule_id uuid references schedule_rules(id) on delete cascade not null,
  due_date date not null,
  status text not null check (status in ('done', 'skipped', 'issue')),
  notes text,
  done_by uuid references auth.users(id) on delete set null,
  done_at timestamptz default now() not null,
  constraint unique_rule_due_date unique (rule_id, due_date)
);

-- ==============================================================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

alter table profiles enable row level security;
alter table categories enable row level security;
alter table groups enable row level security;
alter table equipment enable row level security;
alter table schedule_rules enable row level security;
alter table task_logs enable row level security;

-- Helper function: check if currently authenticated user is admin
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- PROFILES POLICIES
create policy "Authenticated users can read all profiles"
  on profiles for select
  to authenticated
  using (true);

create policy "Users can update their own profile"
  on profiles for update
  to authenticated
  using (id = auth.uid() or is_admin())
  with check (id = auth.uid() or is_admin());

create policy "Admins can insert profiles"
  on profiles for insert
  to authenticated
  with check (id = auth.uid() or is_admin());

-- CATEGORIES POLICIES
create policy "Authenticated users can read categories"
  on categories for select
  to authenticated
  using (true);

create policy "Admins can insert/update/delete categories"
  on categories for all
  to authenticated
  using (is_admin())
  with check (is_admin());

-- GROUPS POLICIES
create policy "Authenticated users can read groups"
  on groups for select
  to authenticated
  using (true);

create policy "Admins can insert/update/delete groups"
  on groups for all
  to authenticated
  using (is_admin())
  with check (is_admin());

-- EQUIPMENT POLICIES
create policy "Authenticated users can read equipment"
  on equipment for select
  to authenticated
  using (true);

create policy "Admins can insert/update/delete equipment"
  on equipment for all
  to authenticated
  using (is_admin())
  with check (is_admin());

-- SCHEDULE RULES POLICIES
create policy "Authenticated users can read schedule rules"
  on schedule_rules for select
  to authenticated
  using (true);

create policy "Admins can insert/update/delete schedule rules"
  on schedule_rules for all
  to authenticated
  using (is_admin())
  with check (is_admin());

-- TASK LOGS POLICIES
create policy "Authenticated users can read task logs"
  on task_logs for select
  to authenticated
  using (true);

create policy "Workers can insert/update their own task logs, admins can manage all"
  on task_logs for insert
  to authenticated
  with check (done_by = auth.uid() or is_admin());

create policy "Workers can update their own task logs"
  on task_logs for update
  to authenticated
  using (done_by = auth.uid() or is_admin())
  with check (done_by = auth.uid() or is_admin());

create policy "Workers can delete (undo) their own task logs"
  on task_logs for delete
  to authenticated
  using (done_by = auth.uid() or is_admin());

-- ==============================================================================
-- 5. AUTOMATIC PROFILE CREATION TRIGGER ON SIGNUP
-- ==============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'worker')
  )
  on conflict (id) do update set
    full_name = excluded.full_name;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ==============================================================================
-- 6. SEED DATA (EXACT MASTER MAINTENANCE SCHEDULE)
-- ==============================================================================

-- A. CATEGORIES
insert into categories (code, name, sort_order) values
  ('A', 'Inverter Station Area', 1),
  ('B', 'PV Field Area', 2),
  ('C', 'MV & LV System', 3),
  ('D', 'Other System', 4)
on conflict (code) do nothing;

-- B. GROUPS
do $$
declare
  cat_a uuid;
  cat_b uuid;
  cat_c uuid;
  cat_d uuid;
  grp_id uuid;
  i int;
begin
  select id into cat_a from categories where code = 'A';
  select id into cat_b from categories where code = 'B';
  select id into cat_c from categories where code = 'C';
  select id into cat_d from categories where code = 'D';

  -- CATEGORY A GROUPS
  insert into groups (category_id, item_no, name) values (cat_a, 1, 'Station RMU/ MV Switchgear') returning id into grp_id;
  for i in 1..6 loop
    insert into equipment (group_id, name, unit_count, default_freq, is_active)
    values (grp_id, 'Station RMU/ MV Switchgear ' || i, 1, array['d', 'w', 'M'], true);
  end loop;

  insert into groups (category_id, item_no, name) values (cat_a, 2, 'Transformer') returning id into grp_id;
  for i in 1..6 loop
    insert into equipment (group_id, name, unit_count, default_freq, is_active)
    values (grp_id, 'Transformer ' || i, 1, array['d', 'w', 'M'], true);
  end loop;

  insert into groups (category_id, item_no, name) values (cat_a, 3, 'Inverter') returning id into grp_id;
  for i in 1..12 loop
    insert into equipment (group_id, name, unit_count, default_freq, is_active)
    values (grp_id, 'Inverter ' || i, 1, array['d', 'w', 'M'], true);
  end loop;

  insert into groups (category_id, item_no, name) values (cat_a, 4, 'Station Aux Power Supply Set-up') returning id into grp_id;
  for i in 1..6 loop
    insert into equipment (group_id, name, unit_count, default_freq, is_active)
    values (grp_id, 'Station Aux Power Supply Set-up ' || i, 1, array['M'], true);
  end loop;

  insert into groups (category_id, item_no, name) values (cat_a, 5, 'Structure, Inverter Station') returning id into grp_id;
  for i in 1..5 loop
    insert into equipment (group_id, name, unit_count, default_freq, is_active)
    values (grp_id, 'Structure, Inverter Station ' || i, 1, array[]::text[], true);
  end loop;
  insert into equipment (group_id, name, unit_count, default_freq, is_active)
  values (grp_id, 'Structure, Inverter Station 6', 1, array['Q'], true);

  -- CATEGORY B GROUPS (PV FIELD AREA)
  insert into groups (category_id, item_no, name) values (cat_b, 1, 'PV Module Cleaning') returning id into grp_id;
  insert into equipment (group_id, name, area, unit_count, default_freq, is_active) values
    (grp_id, 'PV Module Cleaning - Area 1', 'Area 1', 1, array['d'], true),
    (grp_id, 'PV Module Cleaning - Area 2', 'Area 2', 1, array['d'], true),
    (grp_id, 'PV Module Cleaning - Area 3', 'Area 3', 1, array['d'], true);

  insert into groups (category_id, item_no, name) values (cat_b, 2, 'Grass Cutting') returning id into grp_id;
  insert into equipment (group_id, name, area, unit_count, default_freq, is_active) values
    (grp_id, 'Grass Cutting - Area 1', 'Area 1', 1, array['w'], true),
    (grp_id, 'Grass Cutting - Area 2', 'Area 2', 1, array['d'], true),
    (grp_id, 'Grass Cutting - Area 3', 'Area 3', 1, array['w'], true),
    (grp_id, 'Grass Cutting - Main Station', null, 1, array['w'], true),
    (grp_id, 'Grass Cutting - Perimeter and Open Areas', null, 1, array['w'], true);

  insert into groups (category_id, item_no, name) values (cat_b, 3, 'PV Mod & Structure') returning id into grp_id;
  insert into equipment (group_id, name, area, unit_count, default_freq, is_active) values
    (grp_id, 'PV Mod & Structure - Area 1', 'Area 1', 1, array['M'], true),
    (grp_id, 'PV Mod & Structure - Area 2', 'Area 2', 1, array['M'], true),
    (grp_id, 'PV Mod & Structure - Area 3', 'Area 3', 1, array['M'], true);

  insert into groups (category_id, item_no, name) values (cat_b, 4, 'PV Combiner Boxes') returning id into grp_id;
  for i in 1..12 loop
    insert into equipment (group_id, name, unit_count, default_freq, is_active)
    values (
      grp_id,
      'DCB-E' || lpad(i::text, 2, '0') || ' x ' || (case when i in (7, 8) then '5' else '6' end),
      case when i in (7, 8) then 5 else 6 end,
      array['M'],
      true
    );
  end loop;

  insert into groups (category_id, item_no, name) values (cat_b, 5, 'Drainage System') returning id into grp_id;
  insert into equipment (group_id, name, area, unit_count, default_freq, is_active) values
    (grp_id, 'Drainage System - Area 1', 'Area 1', 1, array['w', 'M'], true),
    (grp_id, 'Drainage System - Area 2', 'Area 2', 1, array['w', 'M'], true),
    (grp_id, 'Drainage System - Area 3', 'Area 3', 1, array['w', 'M'], true);

  -- CATEGORY C GROUPS (MV & LV SYSTEM)
  insert into groups (category_id, item_no, name) values (cat_c, 1, 'Main Switchboard-34Kv') returning id into grp_id;
  insert into equipment (group_id, name, unit_count, default_freq, is_active) values
    (grp_id, 'Main Switchboard-34Kv', 1, array['d', 'M'], true);

  insert into groups (category_id, item_no, name) values (cat_c, 2, 'Main Aux Switchboard-0.4Kv') returning id into grp_id;
  insert into equipment (group_id, name, unit_count, default_freq, is_active) values
    (grp_id, 'Main Aux Switchboard-0.4Kv', 1, array['d'], true),
    (grp_id, 'Distribution Board Guard House Station', 1, array['w'], true),
    (grp_id, 'Distribution Board Main Station Lighting', 1, array['w'], true),
    (grp_id, 'Distribution Board Water Pump Station', 1, array['w'], true);

  insert into groups (category_id, item_no, name) values (cat_c, 3, 'Main Aux Transformer Bank') returning id into grp_id;
  insert into equipment (group_id, name, unit_count, default_freq, is_active) values
    (grp_id, 'Main Aux Transformer Bank', 1, array['M'], true);

  insert into groups (category_id, item_no, name) values (cat_c, 4, 'Main Battery bank, charger and DC panel') returning id into grp_id;
  insert into equipment (group_id, name, unit_count, default_freq, is_active) values
    (grp_id, 'Main Battery bank, charger and DC panel', 1, array['d'], true);

  -- CATEGORY D GROUPS (OTHER SYSTEM)
  insert into groups (category_id, item_no, name) values (cat_d, 1, 'Aircon Setup') returning id into grp_id;
  insert into equipment (group_id, name, unit_count, default_freq, is_active) values
    (grp_id, 'Aircon Setup', 1, array['M'], true);

  insert into groups (category_id, item_no, name) values (cat_d, 2, 'Building Structure') returning id into grp_id;
  insert into equipment (group_id, name, unit_count, default_freq, is_active) values
    (grp_id, 'Building Structure', 1, array['w'], true);

  insert into groups (category_id, item_no, name) values (cat_d, 3, 'CCTV Set-up') returning id into grp_id;
  insert into equipment (group_id, name, unit_count, default_freq, is_active) values
    (grp_id, 'CCTV Set-up', 1, array['d'], true);

  insert into groups (category_id, item_no, name) values (cat_d, 4, 'Communication & Controller System') returning id into grp_id;
  insert into equipment (group_id, name, unit_count, default_freq, is_active) values
    (grp_id, 'Communication & Controller System', 1, array['d', 'w', 'M'], true);

  insert into groups (category_id, item_no, name) values (cat_d, 5, 'Fire Fighting and Alarm Set-up') returning id into grp_id;
  insert into equipment (group_id, name, unit_count, default_freq, is_active) values
    (grp_id, 'Fire Fighting and Alarm Set-up', 1, array['d', 'M'], true);

  insert into groups (category_id, item_no, name) values (cat_d, 6, 'Lighting Setup') returning id into grp_id;
  insert into equipment (group_id, name, unit_count, default_freq, is_active) values
    (grp_id, 'Lighting Setup', 1, array['M'], true);

  insert into groups (category_id, item_no, name) values (cat_d, 7, 'Ventilation Setup') returning id into grp_id;
  insert into equipment (group_id, name, unit_count, default_freq, is_active) values
    (grp_id, 'Ventilation Setup', 1, array['M'], true);

  insert into groups (category_id, item_no, name) values (cat_d, 8, 'Water Supply Setup') returning id into grp_id;
  insert into equipment (group_id, name, unit_count, default_freq, is_active) values
    (grp_id, 'Water Supply Setup', 1, array['d', 'w', 'M'], true);

  -- INITIAL ACTIVE SCHEDULE RULES (Starting from current month)
  insert into schedule_rules (equipment_id, frequency, start_date, weekday, notes)
  select 
    e.id,
    f.freq,
    current_date,
    case when f.freq = 'w' then 1 else null end,
    'Scheduled routine inspection'
  from equipment e
  cross join lateral unnest(e.default_freq) as f(freq)
  where e.is_active = true and array_length(e.default_freq, 1) > 0;

end $$;

