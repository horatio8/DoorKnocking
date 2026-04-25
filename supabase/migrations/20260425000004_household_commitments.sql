-- household_commitments: one row per "they want to come back" capture from the
-- volunteer flow. Used by the wrap-up summary and a future reminder cron.
--
-- A volunteer can promise multiple times for the same household — each becomes
-- its own row. We don't dedupe at write time; the latest active row is the one
-- the wrap-up screen surfaces.

create table if not exists public.household_commitments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  voter_id uuid references public.voters (id) on delete set null,
  user_id uuid not null references public.users (id) on delete cascade,
  knock_session_id uuid references public.knock_sessions (id) on delete set null,
  knock_event_id uuid references public.knock_events (id) on delete set null,
  promised_at timestamptz not null,
  bucket text not null,           -- 'tonight' | 'tomorrow' | 'weekend' | 'later'
  notified_at timestamptz,        -- when the volunteer was reminded
  resolved_at timestamptz,        -- when the volunteer re-knocked (or admin closed)
  created_at timestamptz not null default now()
);

create index if not exists household_commitments_household_idx
  on public.household_commitments (household_id);
create index if not exists household_commitments_user_idx
  on public.household_commitments (user_id);
create index if not exists household_commitments_promised_idx
  on public.household_commitments (promised_at)
  where resolved_at is null;

alter table public.household_commitments enable row level security;

drop policy if exists household_commitments_self on public.household_commitments;
create policy household_commitments_self on public.household_commitments for all
  using (auth.uid() = user_id or public.is_admin() or public.is_super_admin())
  with check (auth.uid() = user_id or public.is_admin() or public.is_super_admin());
