-- Partial index for the cron mirror-airtable worker. The worker
-- repeatedly runs:
--   select id from knock_events where airtable_synced_at is null
--   order by knocked_at limit 100
-- A normal index on airtable_synced_at would cover most rows
-- (already-synced) for nothing; the partial form indexes only the
-- unsynced rows we actually scan. Tiny on disk + scoped to the
-- workload that needs it.
create index if not exists knock_events_unsynced_idx
  on public.knock_events (knocked_at)
  where airtable_synced_at is null;
