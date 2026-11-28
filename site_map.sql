-- SITE MAP / CLEANING TRACKER (safe to re-run)
-- Layout cells come from the Excel tracker (import them into site_map_cells; do not invent positions).

create table if not exists public.site_map_cells (
  id uuid primary key default gen_random_uuid(),
  area text not null check (area in ('Area 1','Area 2','Area 3')),
  row_no integer not null,
  col_no integer not null,
  label text not null,
  kind text not null default 'table' check (kind in ('table','pathway','label','inverter')),
  unique (area, row_no, col_no)
);

create table if not exists public.cleaning_targets (
  activity text primary key check (activity in ('module','pathway','undertable')),
  cycles_per_year integer not null,
  rounds_per_cycle integer not null,
  target_per_round integer not null,
  confirmed boolean not null default false
);
-- preliminary reference values (NOT confirmed by the engineers)
insert into public.cleaning_targets (activity, cycles_per_year, rounds_per_cycle, target_per_round) values
  ('module', 6, 1, 21), ('pathway', 4, 2, 42), ('undertable', 4, 1, 21)
on conflict (activity) do nothing;

create table if not exists public.cleaning_records (
  id uuid primary key default gen_random_uuid(),
  cell_id uuid not null references public.site_map_cells(id) on delete cascade,
  activity text not null check (activity in ('module','pathway','undertable')),
  cycle integer not null check (cycle between 1 and 12),
  round integer not null default 1 check (round between 1 and 4),
  remarks text,
  recorded_by uuid references auth.users(id),
  recorded_at timestamptz not null default now(),
  unique (cell_id, activity, cycle, round)   -- the three activities are independent
);

alter table public.site_map_cells enable row level security;
alter table public.cleaning_targets enable row level security;
alter table public.cleaning_records enable row level security;

drop policy if exists "cells read" on public.site_map_cells;
create policy "cells read" on public.site_map_cells for select to authenticated using (true);
drop policy if exists "cells admin write" on public.site_map_cells;
create policy "cells admin write" on public.site_map_cells for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "targets read" on public.cleaning_targets;
create policy "targets read" on public.cleaning_targets for select to authenticated using (true);
drop policy if exists "targets admin write" on public.cleaning_targets;
create policy "targets admin write" on public.cleaning_targets for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "records read" on public.cleaning_records;
create policy "records read" on public.cleaning_records for select to authenticated using (true);
drop policy if exists "records insert" on public.cleaning_records;
create policy "records insert" on public.cleaning_records for insert to authenticated
  with check (recorded_by = (select auth.uid()));
drop policy if exists "records delete" on public.cleaning_records;
create policy "records delete" on public.cleaning_records for delete to authenticated
  using (public.is_admin() or recorded_by = (select auth.uid()));

select (select count(*) from public.cleaning_targets) as targets,
       (select count(*) from public.site_map_cells) as cells;
