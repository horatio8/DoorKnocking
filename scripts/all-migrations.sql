-- Campaign OS — Door Knock Platform
-- Migration: enable extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
create extension if not exists "postgis";
-- Enumerated types used across the platform
do $$ begin
  create type user_role as enum ('admin', 'knocker', 'super_admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type household_status as enum (
    'not_knocked', 'no_answer', 'come_back_later',
    'refused', 'contacted', 'mixed'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type voter_status as enum (
    'not_contacted', 'no_answer', 'come_back_later',
    'refused', 'contacted'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type knock_status as enum (
    'no_answer', 'come_back_later', 'refused',
    'contacted', 'wrong_address'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type walkbook_status as enum ('open', 'in_progress', 'complete');
exception when duplicate_object then null; end $$;

do $$ begin
  create type survey_visibility as enum ('all_houses', 'assigned_only');
exception when duplicate_object then null; end $$;

do $$ begin
  create type question_type as enum (
    'single_choice', 'multi_choice', 'short_text',
    'long_text', 'rating_1_5', 'yes_no', 'scale_0_10'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type conflict_resolution as enum (
    'unresolved', 'accepted', 'overridden', 'dismissed'
  );
exception when duplicate_object then null; end $$;
-- Districts: the scoping anchor for every campaign.
create table if not exists public.districts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  country text not null,
  region text not null,
  airtable_base_id text,
  airtable_voters_table_id text,
  default_walkbook_size int not null default 20,
  timezone text not null default 'UTC',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists districts_active_idx on public.districts (active);

-- Seed row for the first live instance.
insert into public.districts
  (slug, name, country, region, airtable_base_id, airtable_voters_table_id, timezone)
values
  ('sc-hd-115', 'SC House District 115', 'US', 'SC',
   'appz0KOPIaQFCxxw3', 'tblCpmh6G97Zy5S8P', 'America/New_York')
on conflict (slug) do nothing;
-- Profile table extending auth.users
create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  full_name text,
  role user_role not null default 'knocker',
  active boolean not null default true,
  default_district_id uuid references public.districts (id) on delete set null,
  district_access uuid[] not null default '{}',
  assigned_walkbook_ids uuid[] not null default '{}',
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists users_role_idx on public.users (role);
create index if not exists users_default_district_idx on public.users (default_district_id);

-- Helper: auto-create profile row on auth sign-up
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();
-- Households: one row per physical address
create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  district_id uuid not null references public.districts (id) on delete cascade,
  airtable_hh_rec_id text not null,
  address_line1 text not null,
  city text,
  state text,
  zip text,
  zip4 text,
  unit text,
  lat numeric(9, 6) not null,
  lng numeric(9, 6) not null,
  geom geography(Point, 4326) generated always as
    (st_setsrid(st_makepoint(lng::double precision, lat::double precision), 4326)::geography) stored,
  neighborhood_id text,
  household_party text,
  status household_status not null default 'not_knocked',
  last_knocked_at timestamptz,
  airtable_synced_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (district_id, airtable_hh_rec_id)
);

create index if not exists households_district_idx on public.households (district_id);
create index if not exists households_status_idx on public.households (status);
create index if not exists households_geom_idx on public.households using gist (geom);

-- Voters: one row per registered individual
create table if not exists public.voters (
  id uuid primary key default gen_random_uuid(),
  district_id uuid not null references public.districts (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  airtable_voter_key text not null,
  state_voter_id text,
  client_id text,
  first_name text,
  middle_name text,
  last_name text,
  suffix text,
  display_name text generated always as (
    trim(both ' ' from coalesce(first_name, '') ||
      case when middle_name is not null and length(middle_name) > 0
        then ' ' || left(middle_name, 1) || '.' else '' end ||
      ' ' || coalesce(last_name, '') ||
      case when suffix is not null and length(suffix) > 0
        then ' ' || suffix else '' end)
  ) stored,
  primary_phone text,
  observed_party text,
  official_party text,
  calculated_party text,
  moved boolean not null default false,
  current_status voter_status not null default 'not_contacted',
  last_knock_event_id uuid,
  airtable_synced_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (district_id, airtable_voter_key)
);

create index if not exists voters_household_idx on public.voters (household_id);
create index if not exists voters_district_idx on public.voters (district_id);
create index if not exists voters_status_idx on public.voters (current_status);
create table if not exists public.walkbooks (
  id uuid primary key default gen_random_uuid(),
  district_id uuid not null references public.districts (id) on delete cascade,
  name text not null,
  description text,
  household_count int not null default 0,
  centroid_lat numeric(9, 6),
  centroid_lng numeric(9, 6),
  bounding_box jsonb,
  estimated_duration_minutes int,
  auto_generated boolean not null default true,
  status walkbook_status not null default 'open',
  created_by uuid references public.users (id) on delete set null,
  airtable_synced_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists walkbooks_district_idx on public.walkbooks (district_id);
create index if not exists walkbooks_status_idx on public.walkbooks (status);

create table if not exists public.walkbook_households (
  walkbook_id uuid not null references public.walkbooks (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  order_index int not null default 0,
  primary key (walkbook_id, household_id)
);

create index if not exists walkbook_households_hh_idx on public.walkbook_households (household_id);

create table if not exists public.walkbook_assignments (
  id uuid primary key default gen_random_uuid(),
  walkbook_id uuid not null references public.walkbooks (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  assigned_by uuid references public.users (id) on delete set null,
  assigned_at timestamptz not null default now(),
  unassigned_at timestamptz
);

-- Only one active assignment per walkbook at a time
create unique index if not exists walkbook_assignments_active_uniq
  on public.walkbook_assignments (walkbook_id)
  where unassigned_at is null;

create index if not exists walkbook_assignments_user_idx
  on public.walkbook_assignments (user_id)
  where unassigned_at is null;
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
create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  district_id uuid not null references public.districts (id) on delete cascade,
  label text not null,
  color text,
  is_standard boolean not null default false,
  created_by uuid references public.users (id) on delete set null,
  promoted_by uuid references public.users (id) on delete set null,
  promoted_at timestamptz,
  usage_count int not null default 0,
  airtable_synced_at timestamptz,
  created_at timestamptz not null default now()
);

-- Case-insensitive label uniqueness scoped by district
create unique index if not exists tags_district_label_uniq
  on public.tags (district_id, lower(label));

create index if not exists tags_district_standard_idx
  on public.tags (district_id, is_standard);

create table if not exists public.voter_tags (
  id uuid primary key default gen_random_uuid(),
  voter_id uuid not null references public.voters (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  applied_by uuid references public.users (id) on delete set null,
  applied_at timestamptz not null default now(),
  knock_event_id uuid references public.knock_events (id) on delete set null,
  airtable_synced_at timestamptz,
  unique (voter_id, tag_id)
);

create index if not exists voter_tags_tag_idx on public.voter_tags (tag_id);

create table if not exists public.voter_notes (
  id uuid primary key default gen_random_uuid(),
  voter_id uuid not null references public.voters (id) on delete cascade,
  knock_event_id uuid references public.knock_events (id) on delete set null,
  author_id uuid references public.users (id) on delete set null,
  body text not null,
  airtable_synced_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists voter_notes_voter_idx on public.voter_notes (voter_id);
create table if not exists public.sync_conflicts (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  description text not null,
  resolution conflict_resolution not null default 'unresolved',
  resolved_by uuid references public.users (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists sync_conflicts_unresolved_idx
  on public.sync_conflicts (resolution)
  where resolution = 'unresolved';

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_user_time_idx on public.audit_log (user_id, created_at desc);
create index if not exists audit_log_entity_idx on public.audit_log (entity_type, entity_id);

-- Used by n8n to remember its last pull cursor per table.
create table if not exists public.sync_state (
  source text not null,
  entity text not null,
  last_synced_at timestamptz,
  last_cursor text,
  primary key (source, entity)
);
-- Derive voter.current_status + household.status from knock_events,
-- flag concurrent-write conflicts, increment tag usage counts, and
-- emit audit log rows.

create or replace function public.status_from_knock(k knock_status)
returns voter_status
language sql
immutable
as $$
  select case k
    when 'no_answer'       then 'no_answer'
    when 'come_back_later' then 'come_back_later'
    when 'refused'         then 'refused'
    when 'contacted'       then 'contacted'
    when 'wrong_address'   then 'not_contacted'
  end::voter_status;
$$;

create or replace function public.recompute_household_status(hh uuid)
returns void
language plpgsql
as $$
declare
  distinct_statuses int;
  single_status voter_status;
  new_status household_status;
begin
  select count(distinct current_status), min(current_status)
    into distinct_statuses, single_status
    from public.voters
   where household_id = hh;

  if distinct_statuses is null or distinct_statuses = 0 then
    new_status := 'not_knocked';
  elsif distinct_statuses = 1 then
    new_status := case single_status
      when 'not_contacted'   then 'not_knocked'
      when 'no_answer'       then 'no_answer'
      when 'come_back_later' then 'come_back_later'
      when 'refused'         then 'refused'
      when 'contacted'       then 'contacted'
    end;
  else
    new_status := 'mixed';
  end if;

  update public.households
     set status = new_status,
         last_knocked_at = (
           select max(knocked_at) from public.knock_events
            where household_id = hh
         ),
         updated_at = now()
   where id = hh;
end;
$$;

create or replace function public.on_knock_event_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  prior_within_5m uuid;
begin
  if new.voter_id is not null then
    select ke.id into prior_within_5m
      from public.knock_events ke
     where ke.voter_id = new.voter_id
       and ke.user_id <> new.user_id
       and ke.knocked_at between new.knocked_at - interval '5 minutes'
                             and new.knocked_at + interval '5 minutes'
       and ke.id <> new.id
     order by ke.knocked_at desc
     limit 1;

    if prior_within_5m is not null then
      update public.knock_events set conflict_flag = true where id in (new.id, prior_within_5m);
      insert into public.sync_conflicts (entity_type, entity_id, description)
      values ('knock_event', new.id,
        format('Knock event %s conflicts with %s for voter %s', new.id, prior_within_5m, new.voter_id));
    end if;

    update public.voters
       set current_status = public.status_from_knock(new.status),
           last_knock_event_id = new.id,
           updated_at = now()
     where id = new.voter_id;
  end if;

  perform public.recompute_household_status(new.household_id);

  insert into public.audit_log (user_id, action, entity_type, entity_id, metadata)
  values (new.user_id, 'knock.create', 'knock_event', new.id,
          jsonb_build_object('status', new.status, 'voter_id', new.voter_id,
                             'household_id', new.household_id));
  return new;
end;
$$;

drop trigger if exists trg_knock_events_after_insert on public.knock_events;
create trigger trg_knock_events_after_insert
  after insert on public.knock_events
  for each row execute function public.on_knock_event_insert();

-- Maintain tags.usage_count
create or replace function public.on_voter_tag_change()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    update public.tags set usage_count = usage_count + 1 where id = new.tag_id;
    insert into public.audit_log (user_id, action, entity_type, entity_id, metadata)
    values (new.applied_by, 'tag.apply', 'voter_tag', new.id,
            jsonb_build_object('tag_id', new.tag_id, 'voter_id', new.voter_id));
    return new;
  elsif tg_op = 'DELETE' then
    update public.tags set usage_count = greatest(usage_count - 1, 0) where id = old.tag_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_voter_tags_change on public.voter_tags;
create trigger trg_voter_tags_change
  after insert or delete on public.voter_tags
  for each row execute function public.on_voter_tag_change();

-- Keep walkbooks.household_count in sync
create or replace function public.on_walkbook_hh_change()
returns trigger
language plpgsql
as $$
declare
  wb uuid;
begin
  wb := coalesce(new.walkbook_id, old.walkbook_id);
  update public.walkbooks
     set household_count = (
       select count(*) from public.walkbook_households where walkbook_id = wb
     )
   where id = wb;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_walkbook_households_change on public.walkbook_households;
create trigger trg_walkbook_households_change
  after insert or delete on public.walkbook_households
  for each row execute function public.on_walkbook_hh_change();
-- Row-level security. Admins (and super_admins) get broad CRUD scoped to their
-- district_access list; knockers get just-enough-to-do-the-job.

-- Helper: current user's role
create or replace function public.current_user_role()
returns user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.users where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select public.current_user_role() in ('admin', 'super_admin');
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
as $$
  select public.current_user_role() = 'super_admin';
$$;

create or replace function public.has_district_access(d uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users u
    where u.id = auth.uid()
      and (d = any(u.district_access) or u.default_district_id = d)
  );
$$;

-- Enable RLS everywhere
alter table public.districts            enable row level security;
alter table public.users                enable row level security;
alter table public.households           enable row level security;
alter table public.voters               enable row level security;
alter table public.walkbooks            enable row level security;
alter table public.walkbook_households  enable row level security;
alter table public.walkbook_assignments enable row level security;
alter table public.knock_events         enable row level security;
alter table public.surveys              enable row level security;
alter table public.survey_questions     enable row level security;
alter table public.survey_responses     enable row level security;
alter table public.tags                 enable row level security;
alter table public.voter_tags           enable row level security;
alter table public.voter_notes          enable row level security;
alter table public.sync_conflicts       enable row level security;
alter table public.audit_log            enable row level security;

-- Districts
drop policy if exists districts_read on public.districts;
create policy districts_read on public.districts for select
  using (public.has_district_access(id) or public.is_super_admin());
drop policy if exists districts_write on public.districts;
create policy districts_write on public.districts for all
  using (public.is_super_admin()) with check (public.is_super_admin());

-- Users
drop policy if exists users_self_read on public.users;
create policy users_self_read on public.users for select
  using (id = auth.uid() or public.is_admin());
drop policy if exists users_self_update on public.users;
create policy users_self_update on public.users for update
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());
drop policy if exists users_admin_write on public.users;
create policy users_admin_write on public.users for insert
  with check (public.is_admin());
drop policy if exists users_admin_delete on public.users;
create policy users_admin_delete on public.users for delete using (public.is_admin());

-- Households / voters: readable to any authed user with district access
drop policy if exists households_read on public.households;
create policy households_read on public.households for select
  using (public.has_district_access(district_id));
drop policy if exists households_admin_write on public.households;
create policy households_admin_write on public.households for all
  using (public.is_admin() and public.has_district_access(district_id))
  with check (public.is_admin() and public.has_district_access(district_id));

drop policy if exists voters_read on public.voters;
create policy voters_read on public.voters for select
  using (public.has_district_access(district_id));
drop policy if exists voters_admin_write on public.voters;
create policy voters_admin_write on public.voters for all
  using (public.is_admin() and public.has_district_access(district_id))
  with check (public.is_admin() and public.has_district_access(district_id));

-- Walkbooks
drop policy if exists walkbooks_read on public.walkbooks;
create policy walkbooks_read on public.walkbooks for select
  using (public.has_district_access(district_id));
drop policy if exists walkbooks_admin_write on public.walkbooks;
create policy walkbooks_admin_write on public.walkbooks for all
  using (public.is_admin() and public.has_district_access(district_id))
  with check (public.is_admin() and public.has_district_access(district_id));

drop policy if exists walkbook_households_read on public.walkbook_households;
create policy walkbook_households_read on public.walkbook_households for select
  using (exists (
    select 1 from public.walkbooks w
    where w.id = walkbook_id and public.has_district_access(w.district_id)
  ));
drop policy if exists walkbook_households_admin_write on public.walkbook_households;
create policy walkbook_households_admin_write on public.walkbook_households for all
  using (public.is_admin()) with check (public.is_admin());

-- Knockers see their own assignments, admins see all
drop policy if exists walkbook_assignments_read on public.walkbook_assignments;
create policy walkbook_assignments_read on public.walkbook_assignments for select
  using (user_id = auth.uid() or public.is_admin());
drop policy if exists walkbook_assignments_admin_write on public.walkbook_assignments;
create policy walkbook_assignments_admin_write on public.walkbook_assignments for all
  using (public.is_admin()) with check (public.is_admin());

-- Knock events: knockers insert own, read all (for live map), update own within 15 min
drop policy if exists knock_events_read on public.knock_events;
create policy knock_events_read on public.knock_events for select
  using (
    exists (
      select 1 from public.households h
      where h.id = household_id and public.has_district_access(h.district_id)
    )
  );
drop policy if exists knock_events_self_insert on public.knock_events;
create policy knock_events_self_insert on public.knock_events for insert
  with check (user_id = auth.uid());
drop policy if exists knock_events_self_update on public.knock_events;
create policy knock_events_self_update on public.knock_events for update
  using (
    (user_id = auth.uid() and knocked_at > now() - interval '15 minutes')
    or public.is_admin()
  )
  with check (
    (user_id = auth.uid() and knocked_at > now() - interval '15 minutes')
    or public.is_admin()
  );
drop policy if exists knock_events_admin_delete on public.knock_events;
create policy knock_events_admin_delete on public.knock_events for delete
  using (public.is_admin());

-- Surveys: knockers see active ones in their district; admins full CRUD
drop policy if exists surveys_read on public.surveys;
create policy surveys_read on public.surveys for select
  using (public.has_district_access(district_id) and (active or public.is_admin()));
drop policy if exists surveys_admin_write on public.surveys;
create policy surveys_admin_write on public.surveys for all
  using (public.is_admin() and public.has_district_access(district_id))
  with check (public.is_admin() and public.has_district_access(district_id));

drop policy if exists survey_questions_read on public.survey_questions;
create policy survey_questions_read on public.survey_questions for select
  using (
    exists (
      select 1 from public.surveys s
      where s.id = survey_id
        and public.has_district_access(s.district_id)
        and (s.active or public.is_admin())
    )
  );
drop policy if exists survey_questions_admin_write on public.survey_questions;
create policy survey_questions_admin_write on public.survey_questions for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists survey_responses_self_insert on public.survey_responses;
create policy survey_responses_self_insert on public.survey_responses for insert
  with check (
    exists (
      select 1 from public.knock_events ke
      where ke.id = knock_event_id and ke.user_id = auth.uid()
    )
  );
drop policy if exists survey_responses_read on public.survey_responses;
create policy survey_responses_read on public.survey_responses for select
  using (
    exists (
      select 1 from public.voters v
      where v.id = voter_id and public.has_district_access(v.district_id)
    )
  );
drop policy if exists survey_responses_admin_write on public.survey_responses;
create policy survey_responses_admin_write on public.survey_responses for all
  using (public.is_admin()) with check (public.is_admin());

-- Tags
drop policy if exists tags_read on public.tags;
create policy tags_read on public.tags for select
  using (public.has_district_access(district_id));
drop policy if exists tags_insert on public.tags;
create policy tags_insert on public.tags for insert
  with check (public.has_district_access(district_id) and created_by = auth.uid());
drop policy if exists tags_admin_update on public.tags;
create policy tags_admin_update on public.tags for update
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists tags_admin_delete on public.tags;
create policy tags_admin_delete on public.tags for delete using (public.is_admin());

drop policy if exists voter_tags_read on public.voter_tags;
create policy voter_tags_read on public.voter_tags for select
  using (
    exists (
      select 1 from public.voters v
      where v.id = voter_id and public.has_district_access(v.district_id)
    )
  );
drop policy if exists voter_tags_self_write on public.voter_tags;
create policy voter_tags_self_write on public.voter_tags for insert
  with check (applied_by = auth.uid());
drop policy if exists voter_tags_self_delete on public.voter_tags;
create policy voter_tags_self_delete on public.voter_tags for delete
  using (
    (applied_by = auth.uid() and applied_at > now() - interval '15 minutes')
    or public.is_admin()
  );

-- Voter notes
drop policy if exists voter_notes_read on public.voter_notes;
create policy voter_notes_read on public.voter_notes for select
  using (
    exists (
      select 1 from public.voters v
      where v.id = voter_id and public.has_district_access(v.district_id)
    )
  );
drop policy if exists voter_notes_self_insert on public.voter_notes;
create policy voter_notes_self_insert on public.voter_notes for insert
  with check (author_id = auth.uid());
drop policy if exists voter_notes_admin_write on public.voter_notes;
create policy voter_notes_admin_write on public.voter_notes for update
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists voter_notes_admin_delete on public.voter_notes;
create policy voter_notes_admin_delete on public.voter_notes for delete
  using (public.is_admin() or (author_id = auth.uid() and created_at > now() - interval '15 minutes'));

-- Sync conflicts + audit log
drop policy if exists sync_conflicts_read on public.sync_conflicts;
create policy sync_conflicts_read on public.sync_conflicts for select
  using (public.is_admin());
drop policy if exists sync_conflicts_admin_write on public.sync_conflicts;
create policy sync_conflicts_admin_write on public.sync_conflicts for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists audit_log_read on public.audit_log;
create policy audit_log_read on public.audit_log for select
  using (public.is_admin() or user_id = auth.uid());

-- sync_state is service-role only; deny client access entirely.
alter table public.sync_state enable row level security;
drop policy if exists sync_state_deny on public.sync_state;
create policy sync_state_deny on public.sync_state for all
  using (false) with check (false);
-- Multi-client support: clients table sits above districts.
-- One client (campaign, org) can own many districts. Everything else
-- (households, voters, walkbooks, knocks…) inherits client scope via its
-- district_id → districts.client_id chain.

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,                 -- subdomain: <slug>.campaignos.com
  name text not null,
  brand jsonb not null default '{}'::jsonb,  -- { primary_color, accent_color, logo_url, short_name }
  contact_email text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists clients_active_idx on public.clients (active);

-- Seed a default client for existing Teller / HD-115 data.
insert into public.clients (slug, name, brand, contact_email)
values (
  'teller',
  'Teller Consulting Group',
  jsonb_build_object(
    'primary_color', '#0B1F3A',
    'accent_color',  '#B5121B',
    'short_name',    'Teller'
  ),
  'hello@tellerconsulting.com'
)
on conflict (slug) do nothing;

-- Attach districts to a client.
alter table public.districts
  add column if not exists client_id uuid references public.clients (id) on delete cascade;

-- Backfill any existing districts onto the default Teller client.
update public.districts
   set client_id = (select id from public.clients where slug = 'teller')
 where client_id is null;

-- Now enforce not-null
alter table public.districts
  alter column client_id set not null;

create index if not exists districts_client_idx on public.districts (client_id);

-- Users gain client-level access. Super-admins span all clients; regular
-- admins may span many (consulting staff) or one (client's own admin).
alter table public.users
  add column if not exists client_access uuid[] not null default '{}';

-- Backfill: anyone who already has district_access for a district under a
-- client also gets that client in their client_access.
update public.users u
   set client_access = (
     select coalesce(array_agg(distinct d.client_id), '{}'::uuid[])
       from public.districts d
      where d.id = any(u.district_access)
   )
 where cardinality(coalesce(u.client_access, '{}'::uuid[])) = 0
   and cardinality(coalesce(u.district_access, '{}'::uuid[])) > 0;

create index if not exists users_client_access_idx on public.users using gin (client_access);
-- RLS helpers and policy updates for the clients layer.

create or replace function public.has_client_access(c uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin()
      or exists (
        select 1 from public.users u
        where u.id = auth.uid()
          and c = any(coalesce(u.client_access, '{}'::uuid[]))
      );
$$;

-- Re-derive has_district_access so it also honours client membership, in case
-- a user only has client_access (the future state) with no explicit district.
create or replace function public.has_district_access(d uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin()
      or exists (
        select 1
          from public.users u
          join public.districts dd on dd.id = d
         where u.id = auth.uid()
           and (
             d = any(coalesce(u.district_access, '{}'::uuid[]))
             or u.default_district_id = d
             or dd.client_id = any(coalesce(u.client_access, '{}'::uuid[]))
           )
      );
$$;

-- Clients table: super-admins full CRUD; anyone with client_access may read
-- their own client.
alter table public.clients enable row level security;

drop policy if exists clients_read on public.clients;
create policy clients_read on public.clients for select
  using (public.has_client_access(id));

drop policy if exists clients_super_write on public.clients;
create policy clients_super_write on public.clients for all
  using (public.is_super_admin()) with check (public.is_super_admin());

-- Districts: tighten to also require client access.
drop policy if exists districts_read on public.districts;
create policy districts_read on public.districts for select
  using (public.has_client_access(client_id));

drop policy if exists districts_write on public.districts;
drop policy if exists districts_super_write on public.districts;
create policy districts_super_write on public.districts for all
  using (public.is_super_admin()) with check (public.is_super_admin());

drop policy if exists districts_admin_write on public.districts;
create policy districts_admin_write on public.districts for update
  using (public.is_admin() and public.has_client_access(client_id))
  with check (public.is_admin() and public.has_client_access(client_id));
-- Per-district Airtable connection state. Each district has at most one
-- connected base + voters table. The mapping is stored as JSON so adding new
-- platform fields doesn't require a schema migration on the client side.

alter table public.districts
  add column if not exists airtable_field_mapping jsonb;

alter table public.districts
  add column if not exists airtable_last_imported_at timestamptz;

alter table public.districts
  add column if not exists airtable_import_status text not null default 'unconfigured';
  -- Valid values: 'unconfigured' | 'mapping_pending' | 'ready' | 'importing' | 'error'

alter table public.districts
  add column if not exists airtable_last_error text;

alter table public.districts
  add column if not exists airtable_last_import_summary jsonb;
  -- e.g. { households_upserted: 200, voters_upserted: 460, geocoded: 12, failed: 0 }
-- Per-client credentials. Separate table so a leaked read on `clients` can't
-- leak the Airtable token. RLS here denies every non-service-role read.
--
-- Anything stored in this table is considered a secret. Never return values
-- from this table in API responses — always resolve server-side only.

create table if not exists public.client_credentials (
  client_id uuid primary key references public.clients (id) on delete cascade,
  airtable_token text,
  airtable_workspace_id text,
  airtable_verified_at timestamptz,
  updated_by uuid references public.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.client_credentials enable row level security;

-- Default deny: anon + authed users see nothing. Service-role calls skip RLS
-- entirely, so server-side code can still read/write.
drop policy if exists client_credentials_deny on public.client_credentials;
create policy client_credentials_deny on public.client_credentials for all
  using (false) with check (false);


-- Migration 20260418000005_airtable_oauth
-- Airtable OAuth2 token storage extends client_credentials with access +
-- refresh tokens, expiry, granted scopes, and audit fields.

alter table public.client_credentials
  add column if not exists airtable_access_token text,
  add column if not exists airtable_refresh_token text,
  add column if not exists airtable_token_expires_at timestamptz,
  add column if not exists airtable_scopes text[],
  add column if not exists airtable_user_id text,
  add column if not exists airtable_connected_at timestamptz;
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

