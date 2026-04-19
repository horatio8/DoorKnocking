# Onboarding & billing — next steps

Everything below is *infra / configuration*, not code. The flow in this
repo will pick up each of these automatically once the env var or external
resource exists — no code changes should be needed for the green path.

---

## 1. Apply the migrations

```
supabase/migrations/20260419000003_surveys_spec_v11.sql
supabase/migrations/20260419000004_onboarding_billing.sql
```

Both are idempotent. 014 adds:

- `plans` (seeded with starter / pro / agency)
- `subscriptions`, `invoices`, `usage_meters`, `signup_funnel_events`
- `users` columns: `trial_started_at`, `trial_ends_at`, `stripe_customer_id`,
  `signup_plan`, `email_verified_at`, `setup_completed_at`
- RLS policies for the above.

After applying, verify:

```sql
select id, name, monthly_cents from public.plans;        -- 3 rows
\d public.subscriptions                                  -- exists
\d public.signup_funnel_events                           -- exists
```

---

## 2. Supabase auth settings

In the Supabase dashboard → **Authentication → Providers → Email**:

- Enable **Email confirmation**.
- Site URL: `https://door-knocking.vercel.app` (or the preview URL).
- **Redirect URLs** whitelist: `https://…/verify`.

In **Authentication → Templates → Confirm signup**, set the redirect action to
`{{ .SiteURL }}/verify`. The repo already hands Supabase that value via
`emailRedirectTo` in `/api/onboarding/signup`.

Optional but recommended: SMTP via Resend so outgoing confirmation emails use
a branded sender (`hello@campaignos.com`). Set in
**Authentication → Settings → SMTP**.

---

## 3. Stripe

The repo ships a minimal Stripe client at `lib/billing/stripe.ts` and three
routes:

- `POST /api/billing/checkout` — Paywall A CTA calls this.
- `POST /api/billing/portal` — Billing page "Open Stripe portal ↗".
- `POST /api/webhooks/stripe` — Receives checkout / subscription / invoice
  events.

### 3a. Create the products

Once in the Stripe dashboard (test mode first):

1. Create two products: **Starter** and **Pro**.
2. For each, create two recurring prices: `monthly` (USD 49 / 199) and
   `annual` (USD 490 / 1 990) with a **14-day trial**.
3. Note the four `price_…` ids.

### 3b. Env vars on Vercel

| Name | Value |
|---|---|
| `STRIPE_SECRET_KEY` | `sk_live_…` (or `sk_test_…`) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` from the endpoint below |
| `STRIPE_PRICE_MAP` | `starter_monthly=price_…,starter_annual=price_…,pro_monthly=price_…,pro_annual=price_…` |
| `NEXT_PUBLIC_APP_URL` | `https://door-knocking.vercel.app` |

Without `STRIPE_SECRET_KEY`, `/api/billing/*` routes return `501
billing_disabled` and the paywall surfaces a graceful "Billing isn't live on
this preview yet." message. The webhook no-ops to avoid 500s in CI.

### 3c. Create the webhook endpoint

In Stripe → **Developers → Webhooks**:

- Endpoint URL: `https://door-knocking.vercel.app/api/webhooks/stripe`
- Events to send:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.paid`
  - `invoice.payment_failed`

Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.

### 3d. Enable the Customer Portal

Stripe → **Settings → Billing → Customer Portal**. Enable plan switching and
cancel flow. No URL change — the portal endpoint in this repo constructs the
session on demand.

---

## 4. Promote the civic admin shell

Today `CivicAdminShell` lives at `/demo/*`. The actual `/admin/*` still uses
the older shell. To promote:

1. Swap `app/(admin)/admin/layout.tsx`'s chrome for `CivicAdminShell`.
2. Move `TrialBanner` and `DunningBanner` into that layout so every admin
   page gets the right billing-state chrome automatically.
3. Remove `app/(civic-demo)/demo/*` once review is complete.

---

## 5. Remaining wiring

- **Resend templates**: the six trial emails live at `/demo/emails` as
  visual-only cards. Port each to a Resend template and trigger from a
  Supabase cron that reads `users.trial_started_at`. Cadence per handoff
  README §9.1 (day 0 / 3 / 7 / 12 / 13 / 14).

- **First-voter event**: wire `trackFunnel("first_voter_imported")` inside
  the CSV import route once the import finishes successfully. Already called
  out in the event allowlist.

- **Trial-ended enforcement**: `lib/billing/trial.ts` returns `trialEnded`,
  but no layout gates on it yet. The cleanest move is to add a guard in
  `app/(admin)/admin/layout.tsx`:

  ```ts
  const billing = await getBillingState();
  if (billing.trialEnded && !billing.hasPaymentMethod) {
    redirect("/billing/activate");
  }
  ```

  and similarly wire the dunning banner from `billing.subscriptionStatus`.

- **Paywall B/C CTAs**: both still render the handoff's mock button. Same
  `startCheckout` helper as Paywall A — copy the handler over when you
  decide which variant wins the A/B test.

- **Funnel dashboard**: `/demo/internal/signup-funnel` currently renders
  hardcoded numbers. Swap in a server component that reads
  `signup_funnel_events` via Supabase; the shape of each KPI card already
  matches what a `select event, count(*) …` will return.

---

## 6. Smoke test (happy path)

1. Deploy with the env vars set.
2. Visit `/pricing` → pick Pro → fill signup → receive verification email →
   click it → lands on `/setup/role`.
3. Complete the 3 wizard steps. Confirm:
   - `users.full_name`, `users.signup_plan`, `users.trial_started_at`,
     `users.email_verified_at`, `users.setup_completed_at` are all set.
   - One `clients` row and one `districts` row exist and the user has
     `client_access` / `default_district_id` pointing at them.
4. Land on `/admin` — the real admin surface today; will be the civic one
   once promoted.
5. Hit `/demo/paywall/a`, "Start my Pro plan" → Stripe Checkout → returns
   to `/admin?checkout=success`.
6. Confirm the webhook fired: `subscriptions` row with `status=trialing`,
   `stripe_subscription_id` set, `users.stripe_customer_id` set.
7. `/demo/billing` shows PRO · ACTIVE once the subscription rolls forward.

If any step sticks, `signup_funnel_events` is the canonical trail — every
client-side step fires there, so you can see where the user dropped.
