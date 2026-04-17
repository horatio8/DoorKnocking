create table if not exists public.knock_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  voter_id uuid references public.voters (id) on delete set null,
  user_id uuid not null references public.users (id) on delete restrict,
  walkbook_id uuid references public.walkbooks (id) on delete set null,
  status knock_status not null,
  knocked_at timestamptz not null,
  synced_at timestamptz not null default now(),
  client_event_id text unique,
  duration_seconds int,
  notes text,
  survey_id uuid,
  survey_completed boolean not null default false,
  survey_partial boolean not null default false,
  conflict_flag boolean not null default false,
  airtable_synced_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists knock_events_voter_time_idx
  on public.knock_events (voter_id, knocked_at desc);
create index if not exists knock_events_household_time_idx
  on public.knock_events (household_id, knocked_at desc);
create index if not exists knock_events_user_time_idx
  on public.knock_events (user_id, knocked_at desc);
create index if not exists knock_events_walkbook_idx
  on public.knock_events (walkbook_id);

-- Attach the FK voters.last_knock_event_id now that knock_events exists
alter table public.voters
  drop constraint if exists voters_last_knock_event_fk;
alter table public.voters
  add constraint voters_last_knock_event_fk
  foreign key (last_knock_event_id)
  references public.knock_events (id) on delete set null;
