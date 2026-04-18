-- Trigram indexes for the global search endpoint.
--
-- Without these, ILIKE scans every row on each search; at 900+ voters per
-- district that's fine, but we're going to 10k–50k soon. Trigram GIN
-- indexes make `foo ILIKE '%bar%'` use index seeks instead.
--
-- Also a good canary for the Supabase GitHub integration: purely additive,
-- re-runnable, no data written.

create extension if not exists pg_trgm;

create index if not exists voters_display_name_trgm_idx
  on public.voters using gin (display_name gin_trgm_ops);

create index if not exists voters_last_name_trgm_idx
  on public.voters using gin (last_name gin_trgm_ops)
  where last_name is not null;

create index if not exists voters_primary_phone_trgm_idx
  on public.voters using gin (primary_phone gin_trgm_ops)
  where primary_phone is not null;

create index if not exists households_address_trgm_idx
  on public.households using gin (address_line1 gin_trgm_ops);

create index if not exists walkbooks_name_trgm_idx
  on public.walkbooks using gin (name gin_trgm_ops);

create index if not exists users_email_trgm_idx
  on public.users using gin (email gin_trgm_ops);

create index if not exists users_full_name_trgm_idx
  on public.users using gin (full_name gin_trgm_ops)
  where full_name is not null;
