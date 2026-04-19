# Campaign OS — Door Knock

District-agnostic door-knock management for campaign teams. Ships as a module
within Campaign OS (Teller Consulting Group). First live instance targets
**SC House District 115** — additional districts added without code changes.

## Stack

- **Next.js 14** (App Router), React 18, TypeScript
- **Tailwind CSS** + shadcn/ui components
- **Supabase** (Postgres + PostGIS, Auth, Realtime)
- **Airtable** as admin-facing source of truth (synced via **n8n**)
- **Mapbox GL JS** for the knocker map
- **PWA** with IndexedDB outbox for offline field work
- **Vercel** hosting

## Getting started

```bash
cp .env.example .env.local     # fill in Supabase / Mapbox / Airtable keys
npm install
npm run dev
```

### Database

Migrations live in `supabase/migrations/*.sql`. Run them with `supabase db push`
(CLI) or apply in the Supabase SQL editor.

### Import a district

```bash
npm run import:district -- --district=sc-hd-115
```

Fetches from the Airtable base on the district row, geocodes via Mapbox,
upserts households + voters, then patches lat/lng back to Airtable.

### Adding a new district

1. `INSERT` a row into `districts` (or use `/admin/districts` as a super admin).
2. Provide the Airtable base + voters table IDs.
3. Run `npm run import:district -- --district=<slug>`.
4. Optional: click “Auto-generate walkbooks” in the admin UI.

## Architecture at a glance

```
┌──────────────┐   5 r/s   ┌──────────────┐
│   Airtable   │◄─────────►│     n8n      │
└──────────────┘            └──────┬───────┘
                                   ▼
┌──────────────┐ realtime ┌──────────────┐
│  Next.js PWA │◄────────►│   Supabase   │
└──────┬───────┘          └──────────────┘
       ▼
 IndexedDB + Service Worker (offline outbox + map tile cache)
```

Authoritative schema is Postgres; Airtable mirrors admin-facing subsets.

## Repo layout

- `app/` — Next.js routes (auth / knocker / admin / API)
- `components/` — Shared + feature components
- `lib/` — Supabase clients, Airtable client, offline (idb + sync worker),
  geo (clustering, distance, mapbox), auth/session helpers
- `scripts/` — One-off ops scripts (`import-district.ts`, `seed-test-data.ts`)
- `supabase/migrations/` — Versioned SQL
- `supabase/functions/walkbook-generate/` — Edge Function mirror of the API route
- `tests/` — Vitest suites
- `docs/` — n8n workflow configuration

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start Next.js |
| `npm run test` | Vitest (unit) |
| `npm run test:e2e` | Playwright (integration) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run import:district -- --district=<slug>` | Pull + geocode district voter file |

## Testing in the field

See [`docs/pilot-checklist.md`](docs/pilot-checklist.md).

## License

Proprietary — © Teller Consulting Group.
