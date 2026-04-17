create table if not exists public.surveys (
  id uuid primary key default gen_random_uuid(),
  district_id uuid not null references public.districts (id) on delete cascade,
  airtable_survey_id text,
  name text not null,
  description text,
  active boolean not null default false,
  visibility survey_visibility not null default 'all_houses',
  priority int not null default 0,
  airtable_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists surveys_district_active_idx on public.surveys (district_id, active);

create table if not exists public.survey_questions (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references public.surveys (id) on delete cascade,
  order_index int not null default 0,
  question_text text not null,
  question_type question_type not null,
  required boolean not null default false,
  options jsonb,
  help_text text
);

create index if not exists survey_questions_survey_order_idx
  on public.survey_questions (survey_id, order_index);

create table if not exists public.survey_responses (
  id uuid primary key default gen_random_uuid(),
  knock_event_id uuid not null references public.knock_events (id) on delete cascade,
  voter_id uuid not null references public.voters (id) on delete cascade,
  survey_id uuid not null references public.surveys (id) on delete cascade,
  question_id uuid not null references public.survey_questions (id) on delete cascade,
  answer jsonb not null,
  answered_at timestamptz not null default now(),
  airtable_synced_at timestamptz,
  unique (knock_event_id, question_id)
);

create index if not exists survey_responses_voter_idx on public.survey_responses (voter_id);
create index if not exists survey_responses_survey_idx on public.survey_responses (survey_id);

-- FK from knock_events to surveys
alter table public.knock_events
  drop constraint if exists knock_events_survey_fk;
alter table public.knock_events
  add constraint knock_events_survey_fk
  foreign key (survey_id)
  references public.surveys (id) on delete set null;
