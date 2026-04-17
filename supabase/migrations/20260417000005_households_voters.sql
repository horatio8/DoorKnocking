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
