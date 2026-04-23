-- ============================================================
-- Importer overhaul — phase 1: canonical Airtable base ownership
-- + audit trail for uploaded data files.
--
-- The old flow asked admins to connect a bring-your-own Airtable base
-- with an arbitrary schema. The new flow lets them upload a CSV/XLSX
-- which the app pushes into a blank base we provision with a canonical
-- schema (Voters + Households + Knocks + Conversations). That schema
-- lets us mirror knock state + surveys + scripts + conversations
-- back to Airtable without per-client column mapping.
-- ============================================================

-- Canonical-base ids. airtable_base_id + airtable_voters_table_id +
-- airtable_conversations_table_id already exist from earlier migrations.
alter table public.districts
  add column if not exists airtable_is_canonical boolean not null default false,
  add column if not exists airtable_households_table_id text,
  add column if not exists airtable_knocks_table_id text;

-- One row per uploaded file. Lets us replay an import, show history in
-- the admin UI, and surface parse errors without re-running the upload.
create table if not exists public.import_files (
  id uuid primary key default gen_random_uuid(),
  district_id uuid not null references public.districts(id) on delete cascade,
  uploaded_by uuid references public.users(id),
  storage_path text not null,                 -- path inside `import-files` bucket
  original_filename text not null,
  mime_type text,
  size_bytes int,
  row_count int,
  parsed_header jsonb,                        -- normalised header names
  mapping jsonb,                              -- { csv_column: canonical_field_key }
  status text not null default 'uploaded'
    check (status in ('uploaded','parsed','pushed','imported','failed','cancelled')),
  error_message text,
  created_at timestamptz not null default now(),
  pushed_at timestamptz,
  imported_at timestamptz
);
create index if not exists import_files_district_idx
  on public.import_files (district_id, created_at desc);

alter table public.import_files enable row level security;

create policy import_files_read on public.import_files
  for select
  using (public.is_admin() and public.has_district_access(district_id));

create policy import_files_write on public.import_files
  for all
  using (public.is_admin() and public.has_district_access(district_id))
  with check (public.is_admin() and public.has_district_access(district_id));
