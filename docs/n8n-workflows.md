# n8n Sync Workflows

Self-hosted n8n runs two workflows to keep Airtable and Supabase in agreement.
Both use the Supabase service role key (n8n credentials) and a per-district
Airtable PAT.

## Workflow A — Airtable → Supabase (pull, every 5 min)

Entities: `Target Voters`, `Surveys`, `Survey Questions`, `Tags` (standard
only), `Walkbooks`.

Trigger: Cron, every 5 minutes.

Steps per entity:

1. Read `sync_state` for `source='airtable', entity='<table>'` to get the last
   cursor.
2. Query Airtable with `filterByFormula = IS_AFTER({LastModified}, '<cursor>')`
   paginating to completion.
3. Map to Supabase columns (see `lib/airtable/client.ts` for the voter shape).
4. `upsert` to Supabase on `(district_id, airtable_*)` unique key.
5. Write back the new cursor to `sync_state`.

## Workflow B — Supabase → Airtable (push, every 2 min)

Entities: `knock_events`, `survey_responses`, `voter_tags`, ad-hoc `tags`,
`households.status` changes.

Steps per entity:

1. Query Supabase for rows where `airtable_synced_at IS NULL OR updated_at > airtable_synced_at`.
2. Chunk into batches of ≤ 10 records (Airtable write ceiling).
3. Upsert to the corresponding Airtable table.
4. Patch `airtable_synced_at = now()` on each Supabase row.

## Rate budget

Airtable allows 5 req/s per base. n8n runs one workflow instance at a time per
base, so we stay safely within budget. The throttle in `lib/airtable/client.ts`
keeps ad-hoc script runs out of n8n's way as well.

## Failure handling

Any upsert failure is retried three times with exponential backoff. A failure
on the fourth attempt writes to `sync_conflicts` with `entity_type='sync'` and
a description identifying the row, so admins see it in `/admin/conflicts`.
