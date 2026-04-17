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
