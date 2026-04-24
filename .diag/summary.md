# diag @ 2026-04-24T20:01:25.303Z

## env
- has_NEXT_PUBLIC_SUPABASE_URL: true
- NEXT_PUBLIC_SUPABASE_URL_host: wrqydigzshnxvfvbdpkw.supabase.co
- has_NEXT_PUBLIC_SUPABASE_ANON_KEY: true
- anon_key_prefix: sb_publishab
- has_SUPABASE_SERVICE_ROLE_KEY: true
- service_role_key_prefix: sb_secret_7X
- has_NEXT_PUBLIC_MAPBOX_TOKEN: true
- has_MAPBOX_SECRET_TOKEN: false
- has_AIRTABLE_API_KEY: true
- has_AIRTABLE_OAUTH_CLIENT_ID: true
- has_AIRTABLE_OAUTH_CLIENT_SECRET: true
- has_AIRTABLE_OAUTH_REDIRECT_URI: true
- AIRTABLE_OAUTH_REDIRECT_URI: https://door-knocking.vercel.app/api/airtable/oauth/callback
- has_APP_SECRET: true
- has_ANTHROPIC_API_KEY: true
- has_RESEND_API_KEY: true
- has_NEXT_PUBLIC_APP_URL: true
- node_version: v24.14.1

## checks
- ✅ auth.settings — status=200
- ✅ anon.districts_select — 
- ✅ service_role.list_users — count=1
- ✅ service_role.users_count — count=7
- ✅ users.orphan_check — all public.users rows have a matching auth.users entry
- ❌ migrations.repo_vs_db — Invalid schema: supabase_migrations

## tables
- clients: 2
- client_credentials: 2
- districts: 2
- users: 7
- voters: 460
- households: 460
- walkbooks: 37
- walkbook_households: 460
- walkbook_assignments: 71
- walk_time_calibration: 2
- walkbook_generation_runs: 4
- knock_events: 30
- surveys: 3
- survey_questions: 13
- survey_responses: 0
- tags: 2
- voter_tags: 0


## vercel
- state: READY
- sha: e21f47e
- target: production
- created: 2026-04-24T20:00:28Z
- url: door-knocking-9avpkhn51-tellerconsulting.vercel.app
