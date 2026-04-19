# Handoff: Campaign OS — Self-Serve Onboarding & Billing

## Overview

This handoff packages a full self-serve onboarding + billing flow for **Campaign OS**, a door-to-door canvassing SaaS aimed at down-ballot political campaigns and consultants. The design covers acquisition (pricing), signup (email + verification), onboarding (3-step wizard), the free-trial experience (empty dashboard), conversion (three paywall variations), ongoing billing management, edge-case states (trial-ended, dunning), transactional email templates, and an internal funnel dashboard. 15 screens total.

Goal per spec: **landing page → imported voters in under 10 minutes**, no sales call required for Starter and Pro.

## About the Design Files

The files in this bundle are **design references created in HTML** — interactive prototypes showing intended look, layout, and behavior. They are **not production code to copy directly**.

Your task is to **recreate these HTML designs in the target codebase's environment** (per the spec: Next.js + Supabase + Stripe + Tailwind, or whatever the actual repo uses) using its established patterns, component library, and state management. If no environment exists yet, choose an appropriate stack (Next.js App Router + Tailwind + shadcn/ui is a reasonable default given the spec's stack).

**Do not ship the HTML.** Do not port the inline-JSX / Babel setup. Translate every visual decision — spacing, type scale, color, component composition — into idiomatic code in the target framework.

## Fidelity

**High-fidelity.** These are pixel-level mockups with final colors, typography, spacing, and interaction states. Recreate pixel-perfect, using the codebase's existing primitives where they exist.

## Design Direction (Aesthetic)

**"Conservative civic"** — the design should feel like a trusted institution, not another SaaS. Type-led, document-like, hairline rules, stamped seals, no gradients, no emoji, no decorative SVG illustrations. Trust is paramount; campaigns put sensitive voter data here.

Reference points: Federalist-era print, modern civic-tech (gov.uk), premium legal/financial products.

## Design Tokens

### Colors

| Token | Value | Usage |
|---|---|---|
| `--ink` | `#1A1817` | Primary text |
| `--ink-2` | `#2E2B27` | Body copy |
| `--navy` | `#0B2545` | Primary actions, headings, nav |
| `--navy-2` | `#143059` | Primary hover |
| `--navy-3` | `#1E4680` | Chart/data fills |
| `--oxblood` | `#8B2635` | Accent, "recommended" CTA, highlights, data-warning |
| `--oxblood-2` | `#6E1E2A` | Oxblood hover |
| `--gold` | `#A47E3B` | Secondary accent (sparingly) |
| `--parchment` | `#F7F3EC` | Warm off-white panels, hero sections |
| `--parchment-2` | `#EEE7DB` | Slightly deeper parchment |
| `--paper` | `#FBFAF6` | Default page background |
| `--white` | `#FFFFFF` | Cards, inputs |
| `--rule` | `#CFC7B5` | Default borders |
| `--rule-2` | `#E3DCCC` | Subtle dividers |
| `--rule-dark` | `#1F1C18` | Heavy rules |
| `--mute` | `#6B655A` | Secondary text |
| `--mute-2` | `#8C867A` | Placeholder text |
| `--green` | `#2E5E3A` | Success / active status |
| `--amber` | `#8A6A1B` | Warning / past-due status |

**Do not invent new colors.** All accents share the family above. Status badges: green=active/paid, amber=past_due, oxblood=failed/danger.

### Typography

| Role | Family | Notes |
|---|---|---|
| Display / headings | **Source Serif 4** (500–600) | Institutional, letter-spacing −0.01em on h1/h2 |
| UI / body | **Inter** (400–700) | All interactive chrome |
| Numerics / code / data | **JetBrains Mono** (400–600) | Prices, invoice IDs, IPs, ZIP, IDs; use `font-feature-settings: 'tnum'` |

Type scale:
- h1: 44px / 1.05 · h2: 30px / 1.1 · h3: 20px / 1.25 · h4: 16px / 1.3
- Body: 15px / 1.5
- Eyebrow / small-caps labels: 11px, letter-spacing 0.14em, uppercase, weight 600
- Table headers: 11px, letter-spacing 0.08em, uppercase

### Spacing, radii, shadow

- Radii are deliberately small: `2px` / `3px` / `4px` — this is paper, not plastic. **No pill buttons, no rounded cards > 4px.**
- Shadows are soft and papery: `0 1px 0 rgba(26,24,23,0.04), 0 0 0 1px border-color`. Avoid glowy, blurry drop shadows.
- Generous whitespace. Grid-based layouts. 24–32px section padding on desktop.

### Motifs (use sparingly — once per screen max)

- **Star divider**: `★ ★ ★` in oxblood between horizontal rules (seen on pricing eyebrow and signup testimonial).
- **Double rule**: `border-top: 3px double var(--rule-dark)` — used on wizard card heads and totals lines.
- **Seal**: 44×44 concentric circles, 1.5px + 1px stroke, for avatars / empty-state icons.
- **Vol./No. serial** in top-right of navy panels (e.g. "VOL. I · NO. 47") — evokes newspaper masthead.

## Screens

All screens are accessed via the top ribbon. The spec-mandated flow order: `01 Pricing → 02 Signup → 03 Verify → 04–06 Wizard → 07 Empty Dashboard → 08–10 Paywall → 11 Billing`. Edge states (12/13), emails (14), funnel (15) sit adjacent.

### 01 · Pricing (`/pricing`)

**Purpose:** Convert landing-page visitors into signups. Three-plan layout with annual/monthly toggle.

**Layout:** Full-width. Hero section on parchment, then three cards side-by-side (mobile: stacked), then a full feature-comparison matrix, then a navy trust strip.

**Hero:**
- Eyebrow: `★ PRICING ★` in oxblood
- H1: "Honest pricing for *serious campaigns.*" — "serious campaigns" in italic serif oxblood
- Subcopy: "Fourteen days free. No credit card until the last day of your trial. Cancel with one click."
- Interval toggle: two buttons, navy=selected, white=unselected, 1px parchment border wrapper, no rounded corners. Annual shows "− 17%" suffix in oxblood.

**Plan cards (3):**
- Starter ($49/mo · $490/yr) · Pro ($199/mo · $1,990/yr, **recommended**, navy fill) · Agency (Custom, sales-led)
- Recommended card: navy background, parchment text, oxblood ribbon tag "★ MOST CHOSEN" in upper-left, `top: -12px`
- Each card: roman numeral (I/II/III) in top-right eyebrow; italic serif pitch line; price row with mono number + "/month"; annual line shows "$X billed annually · **save 17%**" with save amount in oxblood
- Feature list: 9 rows each, check (oxblood) or x (muted + 0.45 opacity for absent features)
- CTA: Starter=primary navy, Pro=oxblood, Agency=ghost

**Feature matrix:**
- On parchment, white table body. 4 groups: Core, AI & automation, Collaboration, Support & security
- Group labels in serif oxblood, 15px
- Pro column has subtle `rgba(11,37,69,0.03)` tint
- Cell values: `true`→check icon (oxblood); `false`→em-dash in mute; string→plain ink-2 (numeric strings get mono)

**Trust strip (navy):**
- 4 stats: "347 campaigns · 1.2M doors · 28 states · 99.9% uptime"
- Numbers in serif 36px, labels in parchment-dimmed eyebrow

### 02 · Signup (`/signup`)

**Purpose:** Email + password + ToS. Per spec: no name field (that's wizard step 1).

**Layout:** Two 50/50 columns.

**Left (paper):** Logo, eyebrow "Begin — Step 1 of 4", h1 "Start your Pro plan.", email + password fields, ToS checkbox, primary submit. Footer trust badges: SOC 2 · Encrypted at rest · US-hosted (with icons).

**Right (navy):** Serial `VOL. I · NO. 47` in top-right dim. Five-star row (oxblood). Pull-quote in serif 28px with "11,400 doors" in oxblood. Attribution row with circle avatar (parchment background, navy serif monogram). Below, "What you'll get" list with 4 oxblood-check items.

### 03 · Verify email (`/verify`)

**Purpose:** "Check your email" parking screen.

- Centered content, max-width 480px
- 72px seal containing mail icon
- Eyebrow "Step 2 of 4 — Verify"
- h1 "Check your email."
- Email address highlighted in navy mono
- **Inline email preview** in a bordered parchment box — white card inside showing From/Subject/body/CTA of the verification email
- Two text links: `→ Simulate verification` (dev/prototype hook) and `Resend email`
- Micro-support link: "Didn't receive? Check spam, or contact support."

### 04–06 · Onboarding wizard

**Shared shell** (`WizardShell`):
- Parchment background
- Top bar: logo-left, "Logged in as james@teller.co · Sign out" right
- Progress rib: eyebrow "Setup · Step N of 3", mono "XX% COMPLETE" right. 3 segments, 4px height, filled navy / unfilled rule-2
- Card: white, 1px rule border, `40px 44px` padding; title h2 + double rule beneath
- Below card: Back (ghost) + Continue (primary) buttons

**Step 1 — About you:**
- Name input
- Role picker: 4 stacked radio-card options (Campaign staff, Consultant ★default, Party/PAC, Other). Selected state: navy border, parchment fill.
- Info footer: parchment panel with info icon — "Your role helps us show the right templates."

**Step 2 — Your first campaign:**
- Campaign name (prefill "Sprouse for SC House 115")
- Candidate name
- Election type: 3-button segmented (Primary / General★ / Advocacy). Active=navy fill.
- Default travel mode: 2-column cards (Walking / Driving★), selected=parchment + navy border

**Step 3 — Your first district:**
- Country + State selects (2-col grid)
- District name
- Target voter count (mono numeric, 160px max)
- Airtable section (eyebrow separator): 2 radio-card options — "Connect my own base" (★default, shows inline PAT input when selected) vs "We'll store your data"
- CTA label: "Finish setup →"

### 07 · Empty dashboard (`/admin/voters`)

**Purpose:** "Show the product" moment per spec §6.4 — trial banner, zero data, locked features hinted.

**Layout:** `220px` navy sidebar + main content.

**Sidebar:**
- Logo + campaign chip (bordered, small eyebrow "Campaign")
- Nav items: Overview / Voters★ / Walkbooks / Turf / Volunteers / Reports / Settings / Billing — each with icon, active state has `rgba(247,243,236,0.1)` fill, oxblood icon
- Footer plan badge (mono, oxblood): "TRIAL · 13 DAYS LEFT"

**Trial banner** (parchment, full-width):
- Star row + "You're on a **14-day free trial** · 13 days remaining · Import up to 100 voters before adding a card."
- Right: oxblood "Add card & unlock →"

**Main:**
- Eyebrow "SC House District 115 · General · Driving"
- h2 "Voter roll · 0 of ~460" (count muted)
- Right: "Connect Airtable" (ghost) + "Import voters →" (primary)
- Empty state: 1.5px dashed border, parchment fill, centered: 64px seal with user icon, h3 "Bring in your first voters.", subcopy, two CTAs (Upload CSV primary, Download sample ghost), trailing eyebrow "Or · explore with sample data"
- Below: 3-card feature grid. "Start a knock session" card is **locked** (`opacity: 0.6`) with an "After card" badge top-right in oxblood.

### 08–10 · Paywall variations

**All three trigger** at: import > 100 voters, walkbook generation, invite > 2 volunteers, or start a knock session. All three include a card form, plan summary, and non-aggressive skip link.

**Stripe Elements stand-in**: the card input is a monospaced mock ("4242 4242 4242 4242"), with stacked expiry / CVV / ZIP grid below. Three brand chips (VISA / MC / AMEX) at far right as thin-bordered badges.

#### A · Broadside (`/billing/activate`) — *default*
- Parchment background, centered single column, max 520px
- Hero: logo, eyebrow "★ Activate your plan ★", h1 "Ready to canvass for real?"
- White card holds: parchment summary box with plan + price + "Today $0.00 / First charge May 3, 2026 $1,990.00", card input, name, country+ZIP split, receipt checkbox, primary CTA "Start my Pro plan" with lock icon
- Below card: muted "Not right now — keep exploring →" link (non-aggressive skip)

#### B · Receipt — *dense, invoice-style*
- Paper background, logo + "Secure checkout via Stripe" top row
- Card with `grid-template-columns: 1fr 420px`. Left=form (numbered sections "1 · Card", "2 · Billing address"). Right=parchment receipt pane.
- Receipt pane: serif title, line-item table (Pro plan $1,990, discount in oxblood − $398, Stripe Tax $0), **double rule**, "Due today $0.00" in serif 30px, "First charge $1,990 · May 3" right-aligned
- "Included" checklist below, order # in dashed-border footer: "ORDER #COS-2026-0043 · 30-day money-back guarantee"

#### C · Modal — *inline moment*
- Paywall appears as a modal over the blurred/darkened empty dashboard
- Dashboard: `filter: blur(2px) saturate(0.8); opacity: 0.55;` with `rgba(11,37,69,0.55)` scrim on top
- Modal: `grid 280px 1fr`, max 780px wide, navy side rail (plan toggle: Starter dimmed, Pro selected with oxblood border + "SELECTED" ribbon) + interval segment "Monthly / Annual −17%"
- Right: form, close `×` button, h3 "One more step.", card + name/ZIP split, oxblood CTA "Unlock Pro — $0 today"

### 11 · Billing management (`/admin/billing`)

Same admin shell, no trial banner, plan badge "PRO · ACTIVE".

- Section eyebrow + h2 "Billing & Plan"
- **Row 1:** Current plan card (1.4fr) + Payment method card (1fr)
  - Current plan: serif 26px plan name, green active badge, 3-column metrics row (Price/Next charge/Started) bounded by thin rules, actions: "Change plan" (primary), "Open Stripe portal ↗" (ghost), "Cancel subscription" muted-right
  - Payment method: VISA chip + mono card number + expiry/name, "Update payment method" full-width ghost, thin rule, "Billing email" label + mono email
- **Usage card:** 4-column meters (Doors / Volunteers / Voice min / AI calls). Serif 22px "used / total", 6px progress bar. When used > 80%, bar + number turn oxblood.
- **Invoices table:** dense table with Invoice ID (mono), date, description, amount (mono+bold), green paid badge, right-aligned "↓ PDF" link.

### 12 · Trial-ended state

- Banner switches to oxblood with warn-icon: "**Your trial has ended.** Read-only mode. Add a card or export data within 27 days." Two CTAs: parchment-on-oxblood "Add a card", ghost "Export data".
- Plan badge: "TRIAL · ENDED"
- Info panel explains locked vs live features (with lock icon)
- Voter table shows with `opacity: 0.75` and party badges (R oxblood / D navy / I mute)

### 13 · Dunning / payment-failed state

- Banner: amber (`#FBF3D9` bg, `#DBC789` border), warn icon, "Payment failed on May 3 — your card was declined. We'll retry on May 5." + oxblood "Update card →"
- Plan badge: "PRO · PAST DUE"
- Main card bordered amber with: eyebrow "Payment issue", serif heading, body with mono Stripe error code in a parchment chip
- **Retry schedule**: 3-column timeline chips (May 3 Failed / May 5 Retry #1 ★next / May 8 Retry #2). Next chip has navy border + parchment fill.
- Below: oxblood primary "Update payment method →" + ghost "Contact support"
- Activity log: mono timestamps + event names + details, dashed rules between rows

### 14 · Trial email templates

Six cards on paper, 3-column grid. Each email:
- Header row: parchment, "Campaign OS <hello@campaignos.com>" left, mono "DAY N" right
- Subject row in thin strip
- Body: logo + brand, eyebrow in oxblood (Welcome / Activation / Mid-trial / Conversion / Final urgency / Read-only), serif 22px headline, 14px body paragraph, small primary CTA button (pointer-events none — visual only), dashed rule, tiny footer line

Per spec §9.1 cadence: Day 0 welcome, Day 3 activation, Day 7 mid-trial, Day 12 conversion, Day 13 final, Day 14 trial-ended.

### 15 · Internal funnel (`/admin/internal/signup-funnel`)

Ink-black "INTERNAL" banner across top with mono URL + "Last updated 2m ago". Teller-employees-only per spec.

- 4 KPI cards: "New paying customers 327 · Trial → paid 33.2% · Median time to paid 11m 42s · Paywall skip 54.1%" — each with inline sparkline SVG, target comparison line
- **Funnel card**: header + striped 9-row drop-off visualization. Each row: `220px label | bar | count | step % | target badge`. Bar widths ∝ absolute count. Bars that miss their target turn oxblood; first row is navy-3 (control).
- Bottom row: UTM breakdown table + "Friction flags" card with 3 annotated items

## Components to build

Minimum reusable primitives:

- `<Button variant="primary|oxblood|ghost|link" size="sm|md|lg">`
- `<Badge variant="navy|oxblood|green|amber|mute" solid?>` with optional `●` dot
- `<Input>` / `<Select>` / `<Textarea>` — 1px rule border, 3px radius, focus ring `0 0 0 3px rgba(11,37,69,0.12)`
- `<Checkbox>` / `<Radio>` — custom-drawn, navy fill when checked
- `<Card>` (white, 1px rule) and `<Paper>` (parchment, 1px rule)
- `<Eyebrow>` — 11px / 0.14em / 600 / uppercase (variants: default mute, oxblood, on-navy)
- `<RadioCard>` — full-width tappable radio-backed card used throughout wizard + paywall
- `<DoubleRule>`, `<StarDivider>`, `<Seal>` decoratives
- `<Progress>` — 6px track, navy fill
- `<BrowserFrame>` / `<PhoneFrame>` — only for the prototype, skip in prod
- `<AdminShell>` — 220px navy sidebar + main + optional top banner slot

**Icon set**: monoline, 16×16, 1.3–1.5px stroke. Provided icons: check, x, arrow, star, shield, lock, mail, map, doc, card, warn, user, flag, chart, gear, download, chevron, info, sparkle. Use `currentColor` so parent can color them.

## Interactions & behavior

| Where | Behavior |
|---|---|
| Pricing interval toggle | Prices + "billed annually" line swap instantly; annual shows `−17%` pill |
| Pricing plan CTA | Starter/Pro → `/signup?plan=X`; Agency → Calendly modal (out of scope of this spec) |
| Signup submit | Call Supabase auth, show Check-Email screen; disable submit until ToS checked |
| Verify link | Marks `email_confirmed = true`, logs in, routes to `/setup/role` (wizard step 1) |
| Wizard Continue | Validate step, persist partial user/client/district, advance progress rib |
| Wizard Back | Keep in-progress data, decrement rib |
| Empty-dashboard "Import voters" | Opens upload; if count > 100 ⇒ redirect to paywall |
| Paywall submit | Stripe.js `confirmCardSetup` with subscription `client_secret`; on success webhook flips status to `trialing` |
| Paywall skip link | Emit `paywall_skipped` funnel event, keep user in trial with 100-voter cap |
| Billing "Change plan" / "Cancel" / "Update method" | Redirect to Stripe Customer Portal (don't rebuild) |
| Trial banner countdown | Computed from `users.created_at + 14 days`; rerenders daily |
| Trial-ended enforcement | When `status = canceled && !card_on_file`, gate routes: readable, no mutations |
| Dunning banner | Shows whenever `subscription.status in ('past_due','unpaid')`; dismisses when a webhook flips back to `active` |

## State & data

Per spec §10, you'll need tables: `plans`, `users` (augmented), `clients` (augmented), `subscriptions`, `invoices`, `usage_meters`, `signup_funnel_events`. Stripe webhook at `POST /api/webhooks/stripe` handles the events in §8.2. RLS policies per §10.7.

Client-side funnel events to emit: `pricing_viewed`, `signup_started`, `email_verified`, `wizard_step_{1,2,3}`, `paywall_viewed`, `paywall_completed`, `paywall_skipped`, `first_voter_imported`.

## Copy

All copy in the prototype is production-ready. Names and examples use "Sprouse for SC House 115" as the demo client — swap for your own seed data before shipping.

## Assets

No external assets are referenced. All iconography is inline SVG built from primitives. The Campaign OS mark is a shield + star drawn inline in `<CampaignOSMark>`. Replace with the real brand mark when available.

## Responsive behavior

- **≥1024px**: Full two-column layouts as shown.
- **768–1023px**: Plan cards stack, signup collapses to single column with testimonial below, wizard card widens, admin sidebar collapses to icon-only (56px wide).
- **<768px**: Follow the `*Mobile` components in the prototype — simpler stacked layouts, single plan card, stacked paywall. Keep all tap targets ≥44px.

## Prototype files in this bundle

- `Campaign OS Onboarding.html` — single self-contained prototype (inlined CSS + all JSX). Open in a browser to see every screen. Top ribbon navigates between them; Tweaks panel in the host switches paywall variant, mobile companion visibility, etc.
- `styles.css` — the design system stylesheet (tokens + primitives) — authoritative source for colors, fonts, buttons, inputs, badges, etc.
- `components/*.jsx` — per-screen React component source:
  - `shared.jsx` — Icon set, `<CampaignOSMark>`, `<BrowserFrame>`, `<PhoneFrame>`, masthead/footer
  - `pricing.jsx` — PricingPage + PricingMobile + PLANS data
  - `signup.jsx` — SignupPage, CheckEmailPage, SignupMobile
  - `wizard.jsx` — WizardShell + 3 step components
  - `dashboard.jsx` — AdminShell, TrialBanner, EmptyDashboard
  - `paywall.jsx` — PaywallA/B/C + StripeCardInput mock + PaywallMobile
  - `billing.jsx` — BillingPage with usage meters and invoices
  - `states.jsx` — TrialEndedView, DunningView with banners
  - `emails.jsx` — 6 email template cards
  - `funnel.jsx` — Internal funnel dashboard with KPIs, drop-off chart, UTM table
  - `app.jsx` — screen router, top ribbon, Tweaks panel wiring

Treat `styles.css` + each `.jsx` file as **authoritative spec for its screen** — pixel values, component composition, copy, and data shapes are all there.
