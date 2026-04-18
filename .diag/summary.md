# diag @ 2026-04-18T17:25:56.093Z

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
- ✅ service_role.users_count — count=3
- ✅ users.orphan_check — all public.users rows have a matching auth.users entry

## tables
- clients: 2
- client_credentials: 2
- districts: 2
- users: 3
- voters: 920
- households: 920
- walkbooks: 0
- walkbook_stops: 0
- door_knocks: 0
- surveys: 0
- survey_questions: 0
- survey_answers: 0
- tags: 0
- voter_tags: 0
