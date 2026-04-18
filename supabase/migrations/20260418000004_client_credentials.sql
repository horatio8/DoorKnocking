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
