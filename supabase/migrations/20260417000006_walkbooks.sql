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
