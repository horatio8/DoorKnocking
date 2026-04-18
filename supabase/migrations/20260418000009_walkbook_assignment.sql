-- Walkbook assignment: batches, sessions, user capacity/pace fields.
--
-- See WALKBOOK_ASSIGNMENT.md §2. This is the schema half of Phase A1.

-- 1. Extend walkbook_assignments for batch tracking + free-form notes.
alter table public.walkbook_assignments
  add column if not exists assignment_batch_id uuid,
  add column if not exists assignment_notes text;

create index if not exists walkbook_assignments_batch_idx
  on public.walkbook_assignments (assignment_batch_id);

-- 2. assignment_batches: one row per "Confirm & Notify" click. Audit trail
--    that makes batch-undo and history views trivial to implement.
create table if not exists public.assignment_batches (
  id uuid primary key default gen_random_uuid(),
  district_id uuid not null references public.districts (id) on delete cascade,
  created_by uuid references public.users (id) on delete set null,
  method text not null check (method in ('manual', 'auto', 'hybrid')),
  walkbook_count int not null default 0,
  volunteer_count int not null default 0,
  total_duration_minutes int not null default 0,
  total_doors int not null default 0,
  notes text,
  undone_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists assignment_batches_district_idx
  on public.assignment_batches (district_id, created_at desc);

alter table public.walkbook_assignments
  add constraint walkbook_assignments_batch_fk
  foreign key (assignment_batch_id) references public.assignment_batches (id)
  on delete set null
  deferrable initially deferred;

-- 3. assignment_sessions: edit-mutex. One admin at a time per district.
--    held_until is a soft TTL the UI renews via heartbeat every ~60s;
--    after expiry the session is up for grabs.
create table if not exists public.assignment_sessions (
  district_id uuid primary key references public.districts (id) on delete cascade,
  held_by uuid references public.users (id) on delete set null,
  held_at timestamptz not null default now(),
  held_until timestamptz not null,
  notes text
);

-- 4. users: availability + total campaign capacity + pace rating.
do $$ begin
  alter table public.users
    add column if not exists availability text not null default 'available',
    add column if not exists total_time_budget_minutes int not null default 480,
    add column if not exists speed_rating text not null default 'medium';
exception when others then null; end $$;

do $$ begin
  alter table public.users
    add constraint users_availability_check
    check (availability in ('available', 'unavailable', 'out_in_field'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.users
    add constraint users_speed_rating_check
    check (speed_rating in ('slow', 'medium', 'fast'));
exception when duplicate_object then null; end $$;

-- RLS: admins with client access can read/write batches + sessions.
alter table public.assignment_batches enable row level security;
drop policy if exists assignment_batches_read on public.assignment_batches;
create policy assignment_batches_read on public.assignment_batches for select
  using (public.has_district_access(district_id) or public.is_super_admin());
drop policy if exists assignment_batches_write on public.assignment_batches;
create policy assignment_batches_write on public.assignment_batches for all
  using (public.is_admin() or public.is_super_admin())
  with check (public.is_admin() or public.is_super_admin());

alter table public.assignment_sessions enable row level security;
drop policy if exists assignment_sessions_rw on public.assignment_sessions;
create policy assignment_sessions_rw on public.assignment_sessions for all
  using (public.is_admin() or public.is_super_admin())
  with check (public.is_admin() or public.is_super_admin());
