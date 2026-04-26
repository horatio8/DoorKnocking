-- Phase Q1+Q2 — Voter queue model.
--
-- Replaces the static-walkbook planning model with a continuously-scored
-- voter queue. Every unknocked voter gets a score; an ephemeral walkbook
-- is just the top of the queue, sliced to fit a session and routed.
--
-- See VOTER_QUEUE_BRIEF.md (in-message) for the full spec.
--
-- This migration is additive — old `walkbooks` and `walkbook_households`
-- rows keep working until the cutover finishes.

-- ─── Walkbook columns the queue model needs ──────────────────────────────

alter table public.walkbooks
  add column if not exists knocker_id uuid references public.users (id) on delete set null,
  add column if not exists pace_multiplier numeric(3, 2) not null default 1.0,
  add column if not exists travel_mode text not null default 'walking',
  add column if not exists voters_planned int not null default 0,
  add column if not exists voters_knocked int not null default 0,
  add column if not exists contacts_made int not null default 0,
  add column if not exists starting_lat numeric(9, 6),
  add column if not exists starting_lng numeric(9, 6),
  add column if not exists scoring_weights jsonb,
  add column if not exists generation_seed text;

do $$
begin
  alter table public.walkbooks
    add constraint walkbooks_travel_mode_check
    check (travel_mode in ('walking', 'driving'));
exception when duplicate_object then null; end $$;

create index if not exists walkbooks_knocker_status_idx
  on public.walkbooks (knocker_id, status)
  where knocker_id is not null;

-- ─── walkbook_voters — the route, voter-keyed ────────────────────────────

create table if not exists public.walkbook_voters (
  walkbook_id uuid not null references public.walkbooks (id) on delete cascade,
  voter_id uuid not null references public.voters (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  route_order int not null,
  score_at_generation numeric(4, 3) not null,
  is_backlog boolean not null default false,
  primary key (walkbook_id, voter_id)
);

create index if not exists walkbook_voters_order_idx
  on public.walkbook_voters (walkbook_id, route_order);
create index if not exists walkbook_voters_household_idx
  on public.walkbook_voters (household_id);

alter table public.walkbook_voters enable row level security;

drop policy if exists walkbook_voters_self on public.walkbook_voters;
create policy walkbook_voters_self on public.walkbook_voters for all
  using (
    exists (
      select 1 from public.walkbooks w
      where w.id = walkbook_voters.walkbook_id
        and (w.knocker_id = auth.uid() or public.is_admin() or public.is_super_admin())
    )
  )
  with check (
    exists (
      select 1 from public.walkbooks w
      where w.id = walkbook_voters.walkbook_id
        and (w.knocker_id = auth.uid() or public.is_admin() or public.is_super_admin())
    )
  );

-- ─── voter_scores — nightly base score, updated on demand for v1 ─────────
--
-- For v1 we compute final_score live on every generation; the table exists
-- so the nightly job (Phase Q1) can land later without a schema change.

create table if not exists public.voter_scores (
  voter_id uuid primary key references public.voters (id) on delete cascade,
  district_id uuid not null references public.districts (id) on delete cascade,
  base_score numeric(4, 3) not null default 0,
  priority_component numeric(4, 3),
  freshness_component numeric(4, 3),
  household_at_home_prior numeric(4, 3),
  cluster_bonus numeric(4, 3),
  computed_at timestamptz not null default now()
);

create index if not exists voter_scores_district_score_idx
  on public.voter_scores (district_id, base_score desc);

alter table public.voter_scores enable row level security;

drop policy if exists voter_scores_read on public.voter_scores;
create policy voter_scores_read on public.voter_scores for select
  using (public.has_district_access(district_id));

drop policy if exists voter_scores_admin_write on public.voter_scores;
create policy voter_scores_admin_write on public.voter_scores for all
  using (public.is_admin() or public.is_super_admin())
  with check (public.is_admin() or public.is_super_admin());

-- ─── at_home_calibration — district baseline, seeded with brief defaults ─

create table if not exists public.at_home_calibration (
  district_id uuid not null references public.districts (id) on delete cascade,
  day_of_week int not null check (day_of_week between 0 and 6),
  hour int not null check (hour between 0 and 23),
  at_home_rate numeric(4, 3) not null,
  sample_size int not null default 0,
  last_updated_at timestamptz not null default now(),
  primary key (district_id, day_of_week, hour)
);

alter table public.at_home_calibration enable row level security;

drop policy if exists at_home_calibration_read on public.at_home_calibration;
create policy at_home_calibration_read on public.at_home_calibration for select
  using (public.has_district_access(district_id));

drop policy if exists at_home_calibration_admin_write on public.at_home_calibration;
create policy at_home_calibration_admin_write on public.at_home_calibration for all
  using (public.is_admin() or public.is_super_admin())
  with check (public.is_admin() or public.is_super_admin());
