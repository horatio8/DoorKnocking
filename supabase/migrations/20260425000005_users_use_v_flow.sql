-- Per-user feature flag for the rebuilt /v/* volunteer flow.
--
-- When `true`, `/app` redirects the user into the new flow at `/v`.
-- When `false` (default), they hit the legacy /app/* knocker app.
-- A short-lived cookie (`v_flow`) overrides this column for ad-hoc
-- testing; see lib/volunteer/flag.ts.

alter table public.users
  add column if not exists use_v_flow boolean not null default false;

create index if not exists users_use_v_flow_idx
  on public.users (use_v_flow)
  where use_v_flow = true;
