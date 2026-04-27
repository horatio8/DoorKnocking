-- Move the /v feature flag from per-user to per-client and flip it on by
-- default. Per-user overrides are dropped — admins toggle the new flow
-- per campaign from /admin/clients/<slug>/settings; testers can still
-- flip themselves with the v_flow cookie.

alter table public.clients
  add column if not exists use_v_flow boolean not null default true;

create index if not exists clients_use_v_flow_idx
  on public.clients (use_v_flow)
  where use_v_flow = true;

drop index if exists public.users_use_v_flow_idx;

alter table public.users
  drop column if exists use_v_flow;
