# diag @ 2026-04-18T21:19:10.633Z

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
- node_version: v24.13.0

## checks
- ✅ auth.settings — status=200
- ✅ anon.districts_select — 
- ✅ service_role.list_users — count=1
- ✅ service_role.users_count — count=4
- ✅ users.orphan_check — all public.users rows have a matching auth.users entry

## tables
- clients: 2
- client_credentials: 2
- districts: 2
- users: 4
- voters: 920
- households: 920
- walkbooks: 109
- walkbook_households: 456
- walkbook_assignments: 0
- walk_time_calibration: 1
- walkbook_generation_runs: 1
- knock_events: 0
- surveys: 0
- survey_questions: 0
- survey_responses: 0
- tags: 0
- voter_tags: 0


## vercel
- state: ERROR
- sha: 014d5a8
- target: production
- created: 58266-07-15T03:47:30Z
- url: door-knocking-ckik38sf6-jamesflynn-2033s-projects.vercel.app
