-- Per-district Airtable connection state. Each district has at most one
-- connected base + voters table. The mapping is stored as JSON so adding new
-- platform fields doesn't require a schema migration on the client side.

alter table public.districts
  add column if not exists airtable_field_mapping jsonb;

alter table public.districts
  add column if not exists airtable_last_imported_at timestamptz;

alter table public.districts
  add column if not exists airtable_import_status text not null default 'unconfigured';
  -- Valid values: 'unconfigured' | 'mapping_pending' | 'ready' | 'importing' | 'error'

alter table public.districts
  add column if not exists airtable_last_error text;

alter table public.districts
  add column if not exists airtable_last_import_summary jsonb;
  -- e.g. { households_upserted: 200, voters_upserted: 460, geocoded: 12, failed: 0 }
