-- Phase W1 — time-budgeted walkbook generation.
--
-- Extends `walkbooks` with a lifecycle discriminator and time-budget fields,
-- introduces a per-district walk-time calibration table (populated by the
-- nightly job in phase W4), and adds an audit log of every generation run so
-- admins can trace why a walkbook looks the way it does.

alter table public.walkbooks
  add column if not exists kind text not null default 'preset',
  add column if not exists target_duration_minutes int not null default 90,
  add column if not exists actual_knock_minutes int,
  add column if not exists ephemeral boolean not null default false,
  add column if not exists expires_at timestamptz,
  add column if not exists optimized_route_version int not null default 0;

do $$
begin
  alter table public.walkbooks
    add constraint walkbooks_kind_check check (kind in ('preset', 'custom', 'dynamic'));
exception when duplicate_object then null;
end $$;

create index if not exists walkbooks_kind_idx on public.walkbooks (kind);
create index if not exists walkbooks_expires_at_idx on public.walkbooks (expires_at)
  where ephemeral = true;

-- Per-district calibration for estimate_minutes(). Seeded on first generation
-- with defaults; the phase W4 job replaces defaults with empirical values
-- derived from knock_events.duration_seconds.
create table if not exists public.walk_time_calibration (
  district_id uuid primary key references public.districts (id) on delete cascade,
  avg_contact_seconds int not null default 240,
  avg_apartment_seconds int not null default 30,
  avg_walking_speed_kmh numeric(4, 1) not null default 5.0,
  sample_size int not null default 0,
  last_calibrated_at timestamptz not null default now()
);

alter table public.walk_time_calibration enable row level security;

drop policy if exists walk_time_calibration_admin on public.walk_time_calibration;
create policy walk_time_calibration_admin on public.walk_time_calibration for all
  using (public.has_district_access(district_id))
  with check (public.has_district_access(district_id));

-- Audit trail. Every call to walkbook-generate-preset writes one row here.
create table if not exists public.walkbook_generation_runs (
  id uuid primary key default gen_random_uuid(),
  district_id uuid not null references public.districts (id) on delete cascade,
  run_by uuid references public.users (id) on delete set null,
  kind text not null check (kind in ('full_district', 'rebalance', 'dynamic')),
  input_params jsonb not null,
  walkbook_ids uuid[] not null default '{}',
  household_count int not null default 0,
  duration_ms int not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists walkbook_generation_runs_district_idx
  on public.walkbook_generation_runs (district_id, created_at desc);

alter table public.walkbook_generation_runs enable row level security;

drop policy if exists walkbook_generation_runs_read on public.walkbook_generation_runs;
create policy walkbook_generation_runs_read on public.walkbook_generation_runs for select
  using (public.has_district_access(district_id));
