-- Door-knocker experience v2.0 — full schema set for phases K1–K9.
-- See DOORKNOCKER.md for column meanings.

-- ===== Phase K1 — auth & onboarding =====
alter table public.users
  add column if not exists must_change_password boolean not null default false,
  add column if not exists phone text,
  add column if not exists invite_sent_at timestamptz,
  add column if not exists first_login_at timestamptz,
  add column if not exists completed_welcome_at timestamptz,
  add column if not exists commitment_level text,
  add column if not exists next_session_minutes int,
  add column if not exists is_paid_canvasser boolean not null default false,
  add column if not exists gps_consent boolean not null default false,
  add column if not exists gps_consent_at timestamptz,
  add column if not exists gps_consent_version text,
  add column if not exists voice_note_consent boolean not null default false,
  add column if not exists voice_note_consent_at timestamptz;

do $$ begin
  alter table public.users
    add constraint users_commitment_level_check
    check (
      commitment_level is null
      or commitment_level in ('one_time', 'few_sessions', 'regular', 'unknown')
    );
exception when duplicate_object then null; end $$;

-- ===== Phase K3 / K5 — knock sessions =====
create table if not exists public.knock_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  walkbook_id uuid references public.walkbooks (id) on delete set null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  pace_multiplier numeric(3, 2) not null default 1.0,
  walking_coherence_score numeric(3, 2),
  flagged_for_review boolean not null default false,
  flag_reason text,
  knock_count int not null default 0,
  duration_seconds int
);

create index if not exists knock_sessions_user_started_idx
  on public.knock_sessions (user_id, started_at desc);
create index if not exists knock_sessions_walkbook_idx
  on public.knock_sessions (walkbook_id)
  where walkbook_id is not null;

alter table public.knock_sessions enable row level security;
drop policy if exists knock_sessions_self on public.knock_sessions;
create policy knock_sessions_self on public.knock_sessions for all
  using (auth.uid() = user_id or public.is_admin() or public.is_super_admin())
  with check (auth.uid() = user_id or public.is_admin() or public.is_super_admin());

-- ===== Phase K5 — GPS pings =====
create table if not exists public.gps_pings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  session_id uuid references public.knock_sessions (id) on delete set null,
  lat numeric(9, 6) not null,
  lng numeric(9, 6) not null,
  accuracy_meters int,
  recorded_at timestamptz not null default now()
);

create index if not exists gps_pings_user_time_idx
  on public.gps_pings (user_id, recorded_at desc);
create index if not exists gps_pings_session_idx
  on public.gps_pings (session_id)
  where session_id is not null;

alter table public.gps_pings enable row level security;
drop policy if exists gps_pings_self on public.gps_pings;
create policy gps_pings_self on public.gps_pings for all
  using (auth.uid() = user_id or public.is_admin() or public.is_super_admin())
  with check (auth.uid() = user_id);

-- ===== Phase K5 — extend knock_events with GPS =====
alter table public.knock_events
  add column if not exists gps_lat numeric(9, 6),
  add column if not exists gps_lng numeric(9, 6),
  add column if not exists gps_deviation_meters int,
  add column if not exists gps_available boolean not null default true;

-- ===== Phase K6 — AI suggestions log =====
create table if not exists public.ai_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  kind text not null check (kind in (
    'voter_one_liner', 'walkbook_suggestion',
    'conversation_transcript', 'session_debrief'
  )),
  input jsonb,
  output jsonb,
  model text not null,
  tokens_used int,
  cost_cents numeric(10, 4),
  created_at timestamptz not null default now()
);

create index if not exists ai_suggestions_user_created_idx
  on public.ai_suggestions (user_id, created_at desc);

alter table public.ai_suggestions enable row level security;
drop policy if exists ai_suggestions_self_read on public.ai_suggestions;
create policy ai_suggestions_self_read on public.ai_suggestions for select
  using (auth.uid() = user_id or public.is_admin() or public.is_super_admin());

-- Per-client AI budget cap (nullable = unlimited).
alter table public.clients
  add column if not exists ai_budget_monthly_cents int;

-- ===== Phase K8 — messaging =====
create table if not exists public.message_threads (
  id uuid primary key default gen_random_uuid(),
  district_id uuid not null references public.districts (id) on delete cascade,
  kind text not null check (kind in ('broadcast', 'direct')),
  subject text,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists message_threads_district_idx
  on public.message_threads (district_id, created_at desc);

create table if not exists public.message_thread_participants (
  thread_id uuid not null references public.message_threads (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  role text not null check (role in ('sender', 'recipient')),
  joined_at timestamptz not null default now(),
  last_read_at timestamptz,
  muted boolean not null default false,
  primary key (thread_id, user_id)
);

create index if not exists message_thread_participants_user_idx
  on public.message_thread_participants (user_id);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.message_threads (id) on delete cascade,
  sender_id uuid not null references public.users (id) on delete set null,
  body text not null,
  attachment_url text,
  sent_at timestamptz not null default now(),
  deleted_by_sender boolean not null default false,
  deleted_by_recipient boolean not null default false,
  client_message_id text
);

create unique index if not exists messages_client_id_uniq
  on public.messages (client_message_id)
  where client_message_id is not null;
create index if not exists messages_thread_sent_idx
  on public.messages (thread_id, sent_at);

-- RLS: you see threads you participate in; admins see all threads in
-- districts they have access to.
alter table public.message_threads enable row level security;
drop policy if exists message_threads_participants on public.message_threads;
create policy message_threads_participants on public.message_threads for select
  using (
    public.has_district_access(district_id)
    or public.is_super_admin()
    or exists (
      select 1 from public.message_thread_participants p
      where p.thread_id = message_threads.id and p.user_id = auth.uid()
    )
  );
drop policy if exists message_threads_admin_write on public.message_threads;
create policy message_threads_admin_write on public.message_threads for all
  using (public.is_admin() or public.is_super_admin())
  with check (public.is_admin() or public.is_super_admin());

alter table public.message_thread_participants enable row level security;
drop policy if exists mtp_self_or_admin on public.message_thread_participants;
create policy mtp_self_or_admin on public.message_thread_participants for all
  using (
    auth.uid() = user_id
    or public.is_admin()
    or public.is_super_admin()
  )
  with check (
    public.is_admin() or public.is_super_admin()
  );

alter table public.messages enable row level security;
drop policy if exists messages_participant_read on public.messages;
create policy messages_participant_read on public.messages for select
  using (
    public.is_admin() or public.is_super_admin()
    or exists (
      select 1 from public.message_thread_participants p
      where p.thread_id = messages.thread_id and p.user_id = auth.uid()
    )
  );
drop policy if exists messages_sender_write on public.messages;
create policy messages_sender_write on public.messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.message_thread_participants p
      where p.thread_id = thread_id and p.user_id = auth.uid()
    )
  );

-- ===== Phase K9 — voice notes =====
create table if not exists public.voice_notes (
  id uuid primary key default gen_random_uuid(),
  knock_event_id uuid not null references public.knock_events (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  audio_storage_path text not null,
  audio_duration_seconds int,
  audio_format text default 'audio/webm',
  transcript text,
  transcript_confidence numeric(3, 2),
  transcription_status text not null default 'pending'
    check (transcription_status in ('pending', 'processing', 'complete', 'failed')),
  transcribed_at timestamptz,
  ai_summary text,
  ai_suggested_tags text[],
  airtable_synced_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists voice_notes_knock_idx
  on public.voice_notes (knock_event_id);
create index if not exists voice_notes_pending_idx
  on public.voice_notes (created_at)
  where transcription_status = 'pending';

alter table public.voice_notes enable row level security;
drop policy if exists voice_notes_self_rw on public.voice_notes;
create policy voice_notes_self_rw on public.voice_notes for all
  using (auth.uid() = user_id or public.is_admin() or public.is_super_admin())
  with check (auth.uid() = user_id);
