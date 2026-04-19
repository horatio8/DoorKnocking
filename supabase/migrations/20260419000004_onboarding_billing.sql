-- Self-serve onboarding + billing schema. Backs the civic onboarding flow in
-- design_handoff_onboarding_flow/. See docs/ONBOARDING-NEXT-STEPS.md for the
-- remaining wiring (Stripe keys, webhook URL, Resend template ids).

-- ===== Plans (seed data, matches lib/marketing/pricing-data.ts) =====
create table if not exists public.plans (
  id text primary key,
  name text not null,
  monthly_cents int,
  annual_cents int,
  recommended boolean not null default false,
  custom boolean not null default false,
  features jsonb,
  created_at timestamptz not null default now()
);

insert into public.plans (id, name, monthly_cents, annual_cents, recommended) values
  ('starter', 'Starter', 4900, 49000, false),
  ('pro', 'Pro', 19900, 199000, true)
on conflict (id) do update set
  name = excluded.name,
  monthly_cents = excluded.monthly_cents,
  annual_cents = excluded.annual_cents,
  recommended = excluded.recommended;

insert into public.plans (id, name, custom) values ('agency', 'Agency', true)
on conflict (id) do update set custom = excluded.custom;

-- ===== User trial + billing columns =====
alter table public.users
  add column if not exists trial_started_at timestamptz,
  add column if not exists trial_ends_at timestamptz,
  add column if not exists stripe_customer_id text,
  add column if not exists signup_plan text references public.plans (id),
  add column if not exists email_verified_at timestamptz,
  add column if not exists setup_completed_at timestamptz;

create index if not exists users_stripe_customer_idx
  on public.users (stripe_customer_id)
  where stripe_customer_id is not null;

-- ===== Subscriptions (per-client — a user can own multiple campaigns) =====
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  plan_id text not null references public.plans (id),
  interval text not null check (interval in ('monthly', 'annual')),
  status text not null default 'trialing'
    check (status in ('trialing', 'active', 'past_due', 'unpaid', 'canceled', 'incomplete')),
  stripe_subscription_id text,
  stripe_customer_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  trial_end timestamptz,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists subscriptions_stripe_sub_uq
  on public.subscriptions (stripe_subscription_id)
  where stripe_subscription_id is not null;

create index if not exists subscriptions_client_status_idx
  on public.subscriptions (client_id, status);

-- ===== Invoices =====
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid references public.subscriptions (id) on delete set null,
  client_id uuid references public.clients (id) on delete cascade,
  stripe_invoice_id text unique,
  number text,
  amount_cents int not null default 0,
  currency text not null default 'usd',
  status text not null default 'draft'
    check (status in ('draft', 'open', 'paid', 'void', 'uncollectible')),
  description text,
  hosted_invoice_url text,
  pdf_url text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists invoices_client_paid_idx
  on public.invoices (client_id, paid_at desc);

-- ===== Usage meters =====
-- One row per (subscription, metric) for the current billing period.
-- Cron updates `n` and flips period_start/period_end when Stripe rotates.
create table if not exists public.usage_meters (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions (id) on delete cascade,
  metric text not null,
  n numeric not null default 0,
  cap numeric,
  unit text,
  period_start timestamptz not null default now(),
  period_end timestamptz,
  updated_at timestamptz not null default now(),
  unique (subscription_id, metric, period_start)
);

create index if not exists usage_meters_sub_idx on public.usage_meters (subscription_id);

-- ===== Signup funnel events =====
-- Anonymous events are keyed on session_id (a cookie UUID); post-signup we
-- also record the user_id. Everything ends up in Airtable via a nightly
-- mirror — downstream analytics lives there.
create table if not exists public.signup_funnel_events (
  id uuid primary key default gen_random_uuid(),
  event text not null,
  session_id text,
  user_id uuid references public.users (id) on delete set null,
  props jsonb,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  occurred_at timestamptz not null default now()
);

create index if not exists signup_funnel_event_time_idx
  on public.signup_funnel_events (event, occurred_at desc);
create index if not exists signup_funnel_session_idx
  on public.signup_funnel_events (session_id, occurred_at);
create index if not exists signup_funnel_user_idx
  on public.signup_funnel_events (user_id, occurred_at)
  where user_id is not null;

-- ===== RLS =====
alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.invoices enable row level security;
alter table public.usage_meters enable row level security;
alter table public.signup_funnel_events enable row level security;

drop policy if exists plans_public_read on public.plans;
create policy plans_public_read on public.plans for select using (true);

drop policy if exists subscriptions_self_read on public.subscriptions;
create policy subscriptions_self_read on public.subscriptions for select
  using (
    user_id = auth.uid()
    or public.has_client_access(client_id)
    or public.is_admin()
    or public.is_super_admin()
  );

drop policy if exists invoices_self_read on public.invoices;
create policy invoices_self_read on public.invoices for select
  using (
    public.has_client_access(client_id)
    or public.is_admin()
    or public.is_super_admin()
  );

drop policy if exists usage_meters_self_read on public.usage_meters;
create policy usage_meters_self_read on public.usage_meters for select
  using (
    subscription_id in (
      select id from public.subscriptions
      where user_id = auth.uid() or public.has_client_access(client_id)
    )
    or public.is_admin()
    or public.is_super_admin()
  );

-- Funnel is write-anywhere (anonymous), read-admin-only.
drop policy if exists signup_funnel_anon_insert on public.signup_funnel_events;
create policy signup_funnel_anon_insert on public.signup_funnel_events for insert
  with check (true);

drop policy if exists signup_funnel_admin_read on public.signup_funnel_events;
create policy signup_funnel_admin_read on public.signup_funnel_events for select
  using (public.is_admin() or public.is_super_admin());
