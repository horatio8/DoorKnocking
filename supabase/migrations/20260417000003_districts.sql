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
