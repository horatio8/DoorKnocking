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
