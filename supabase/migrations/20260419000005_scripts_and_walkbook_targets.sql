-- C1 for the self-serve scripts / free-chat recording / walkbook-targeted
-- survey batch (see /root/.claude/plans/groovy-sprouting-wren.md).
--
-- Adds:
--   - scripts (talking-points authored by admins)
--   - walkbook_surveys + walkbook_scripts (m:n, pinned flag for "locked")
--   - voice_notes extensions for diarisation + structured summary +
--     voter_id + airtable_conversation_id
--   - knock_sessions.chosen_survey_id / chosen_script_id so the rest of
--     the system can tell what the volunteer picked at the door.

-- ============================================================
-- Scripts
-- ============================================================
create table if not exists public.scripts (
  id uuid primary key default gen_random_uuid(),
  district_id uuid not null references public.districts (id) on delete cascade,
  name text not null,
  body_md text not null,
  status text not null default 'draft'
    check (status in ('draft', 'active', 'paused', 'archived')),
  priority int not null default 0,
  published_at timestamptz,
  created_by uuid references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists scripts_district_status_idx
  on public.scripts (district_id, status);

alter table public.scripts enable row level security;

drop policy if exists scripts_knocker_read on public.scripts;
create policy scripts_knocker_read on public.scripts for select
  using (
    status = 'active'
    and (
      public.has_district_access(district_id)
      or public.is_admin()
      or public.is_super_admin()
    )
  );

drop policy if exists scripts_admin_all on public.scripts;
create policy scripts_admin_all on public.scripts for all
  using (public.is_admin() or public.is_super_admin())
  with check (public.is_admin() or public.is_super_admin());

-- ============================================================
-- Walkbook → survey + walkbook → script link tables
-- Pinned=true on a walkbook_surveys row means volunteers on that walkbook
-- are locked to that survey and see no picker.
-- ============================================================
create table if not exists public.walkbook_surveys (
  walkbook_id uuid not null references public.walkbooks (id) on delete cascade,
  survey_id uuid not null references public.surveys (id) on delete cascade,
  pinned boolean not null default false,
  priority int not null default 0,
  assigned_by uuid references public.users (id),
  assigned_at timestamptz not null default now(),
  primary key (walkbook_id, survey_id)
);

create index if not exists walkbook_surveys_survey_idx
  on public.walkbook_surveys (survey_id);

alter table public.walkbook_surveys enable row level security;

drop policy if exists walkbook_surveys_read on public.walkbook_surveys;
create policy walkbook_surveys_read on public.walkbook_surveys for select
  using (
    walkbook_id in (
      select id from public.walkbooks
      where public.has_district_access(district_id)
    )
    or public.is_admin()
    or public.is_super_admin()
  );

drop policy if exists walkbook_surveys_admin_write on public.walkbook_surveys;
create policy walkbook_surveys_admin_write on public.walkbook_surveys for all
  using (public.is_admin() or public.is_super_admin())
  with check (public.is_admin() or public.is_super_admin());

create table if not exists public.walkbook_scripts (
  walkbook_id uuid not null references public.walkbooks (id) on delete cascade,
  script_id uuid not null references public.scripts (id) on delete cascade,
  pinned boolean not null default false,
  priority int not null default 0,
  assigned_by uuid references public.users (id),
  assigned_at timestamptz not null default now(),
  primary key (walkbook_id, script_id)
);

create index if not exists walkbook_scripts_script_idx
  on public.walkbook_scripts (script_id);

alter table public.walkbook_scripts enable row level security;

drop policy if exists walkbook_scripts_read on public.walkbook_scripts;
create policy walkbook_scripts_read on public.walkbook_scripts for select
  using (
    walkbook_id in (
      select id from public.walkbooks
      where public.has_district_access(district_id)
    )
    or public.is_admin()
    or public.is_super_admin()
  );

drop policy if exists walkbook_scripts_admin_write on public.walkbook_scripts;
create policy walkbook_scripts_admin_write on public.walkbook_scripts for all
  using (public.is_admin() or public.is_super_admin())
  with check (public.is_admin() or public.is_super_admin());

-- ============================================================
-- voice_notes: upgrade for free-chat recordings
--   - voter_id: the conversation partner (was null before; still optional
--     so legacy stop-level voice notes keep working)
--   - speaker_segments: jsonb array of {speaker, start_s, end_s, text}
--   - structured_summary: jsonb from the Claude summariser
--   - airtable_conversation_id: mirror target once pushed
-- ============================================================
alter table public.voice_notes
  add column if not exists voter_id uuid references public.voters (id) on delete set null,
  add column if not exists speaker_segments jsonb,
  add column if not exists structured_summary jsonb,
  add column if not exists airtable_conversation_id text,
  add column if not exists note_kind text
    check (note_kind in ('stop_note', 'conversation')) default 'stop_note';

create index if not exists voice_notes_voter_idx
  on public.voice_notes (voter_id)
  where voter_id is not null;

-- ============================================================
-- knock_sessions: record what the volunteer actually picked at the door
-- ============================================================
alter table public.knock_sessions
  add column if not exists chosen_survey_id uuid references public.surveys (id) on delete set null,
  add column if not exists chosen_script_id uuid references public.scripts (id) on delete set null;

-- ============================================================
-- knock_events: which script was the volunteer reading from when the
-- knock happened? (survey_id is already present)
-- ============================================================
alter table public.knock_events
  add column if not exists script_id uuid references public.scripts (id) on delete set null;

-- ============================================================
-- districts: Airtable table id for the Conversations mirror. Null means
-- the mirror silently skips; admins set this once they've created the
-- Conversations table in their base.
-- ============================================================
alter table public.districts
  add column if not exists airtable_conversations_table_id text;
