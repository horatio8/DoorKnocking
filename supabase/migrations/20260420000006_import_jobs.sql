-- ============================================================
-- Background import jobs. Decouples the Airtable push + Supabase
-- import from the admin's HTTP request — the push route enqueues a
-- row here, a cron worker picks it up, and the admin polls for
-- progress. Lets imports run longer than a Vercel function window
-- and gives us a durable place to track status / errors.
--
-- One row per admin-initiated "push and import" attempt.
-- ============================================================

create table if not exists public.import_jobs (
  id uuid primary key default gen_random_uuid(),
  import_file_id uuid not null references public.import_files (id) on delete cascade,
  district_id uuid not null references public.districts (id) on delete cascade,
  created_by uuid references public.users (id) on delete set null,

  -- Lifecycle. `queued` → `pushing` → `pushed` → `importing` → `imported`
  -- (or `failed` at any step). `paused` is reserved for a future admin
  -- cancel button so we don't bounce between states.
  status text not null default 'queued'
    check (status in ('queued','pushing','pushed','importing','imported','failed','paused')),

  -- Progress counters. Each phase writes the relevant ones so the UI
  -- can show "2,847 of 4,063 geocoded" without extra queries.
  rows_total        int not null default 0,
  rows_pushed       int not null default 0,
  rows_fetched      int not null default 0,
  rows_geocoded     int not null default 0,
  rows_imported     int not null default 0,
  rows_failed       int not null default 0,

  -- Optional detail when status flips to failed. JSONB so we can record
  -- per-row errors later without another schema change.
  error_message     text,
  error_detail      jsonb,

  -- Worker lock. Stops two cron ticks from picking up the same job.
  -- Claim by UPDATE ... WHERE locked_at IS NULL OR locked_at < now() - '5 min'.
  locked_at         timestamptz,
  locked_by         text,

  -- Lets the UI compute elapsed + ETA.
  started_at        timestamptz,
  finished_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists import_jobs_district_created_idx
  on public.import_jobs (district_id, created_at desc);
create index if not exists import_jobs_status_idx
  on public.import_jobs (status)
  where status in ('queued','pushing','importing');

-- Keep updated_at fresh without a trigger — consumers bump it explicitly.
-- (Skipping the generic trigger function to keep the migration self-contained.)

alter table public.import_jobs enable row level security;

drop policy if exists import_jobs_admin_read on public.import_jobs;
create policy import_jobs_admin_read on public.import_jobs
  for select
  using (public.is_admin() and public.has_district_access(district_id));

drop policy if exists import_jobs_admin_write on public.import_jobs;
create policy import_jobs_admin_write on public.import_jobs
  for all
  using (public.is_admin() and public.has_district_access(district_id))
  with check (public.is_admin() and public.has_district_access(district_id));
