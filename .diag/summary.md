# diag @ 2026-06-14T11:35:51.363Z

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
- ❌ auth.settings — status=402
- ❌ anon.districts_select — Service for this project is restricted due to the following violations: exceed_cached_egress_quota. The project owner must upgrade their plan or remove spend caps to restore service.
- ❌ service_role.list_users — Service for this project is restricted due to the following violations: exceed_cached_egress_quota. The project owner must upgrade their plan or remove spend caps to restore service.
- ❌ service_role.users_count — 
- ✅ users.orphan_check — all public.users rows have a matching auth.users entry
- ❌ migrations.repo_vs_db — Service for this project is restricted due to the following violations: exceed_cached_egress_quota. The project owner must upgrade their plan or remove spend caps to restore service.

## tables
- clients: ERROR: 
- client_credentials: ERROR: 
- districts: ERROR: 
- users: ERROR: 
- voters: ERROR: 
- households: ERROR: 
- walkbooks: ERROR: 
- walkbook_households: ERROR: 
- walkbook_assignments: ERROR: 
- walk_time_calibration: ERROR: 
- walkbook_generation_runs: ERROR: 
- knock_events: ERROR: 
- surveys: ERROR: 
- survey_questions: ERROR: 
- survey_responses: ERROR: 
- tags: ERROR: 
- voter_tags: ERROR: 


## vercel
- state: READY
- sha: e30094a
- target: production
- created: 2026-06-14T08:54:14Z
- url: door-knocking-lwvvi86fd-tellerconsulting.vercel.app
