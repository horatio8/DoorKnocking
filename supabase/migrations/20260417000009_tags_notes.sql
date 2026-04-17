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
