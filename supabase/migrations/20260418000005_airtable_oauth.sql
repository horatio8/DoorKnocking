-- Airtable OAuth2 token storage. Extends client_credentials so one row still
-- holds everything we know about a client's Airtable connection — whether
-- they're on the PAT path (legacy) or the OAuth path (preferred).
--
-- All columns inherit the deny-all RLS policy from the parent table; only the
-- service-role bypasses RLS to read these.

alter table public.client_credentials
  add column if not exists airtable_access_token text,
  add column if not exists airtable_refresh_token text,
  add column if not exists airtable_token_expires_at timestamptz,
  add column if not exists airtable_scopes text[],
  add column if not exists airtable_user_id text,
  add column if not exists airtable_connected_at timestamptz;
