# Knock — Marketing Homepage Handoff

**Audience:** Claude Code implementing the `/` route for the Knock / Campaign OS product.
**Source of truth:** `Knock Homepage.html` in this package (self-contained; all tokens & markup present).
**Stack assumption:** Next.js + Tailwind on the front end, Supabase auth, Stripe billing (as in the onboarding handoff you already have).

---

## 1. What this page is

The single public marketing page at `/`. It must:

1. **Convert** — push visitors to `/signup` (14-day trial, no card).
2. **Preserve existing auth affordances** — the current top-right **Sign in** (oxblood) and **Open field app** (ghost) buttons must keep their current login wiring. Do NOT re-implement auth; reuse the existing handlers.
3. **Stitch into the existing onboarding flow** — Starter/Pro/Agency plan CTAs must route into the same Stripe-backed signup flow you built from `design_handoff_onboarding_flow/README.md`.

---

## 2. Design system — use existing tokens, do not invent

All tokens are the Conservative Civic system already shipped in `styles.css`. Do **not** add colors, fonts, or radii.

- Colors: `--navy #0B2545`, `--oxblood #8B2635`, `--parchment #F7F3EC`, `--paper #FBFAF6`, `--ink #1A1817`, `--rule #CFC7B5`. Dark surfaces = navy; body = paper; subtle panels = parchment.
- Type: Source Serif 4 (headlines), Inter (UI), JetBrains Mono (numerics).
- Radii: 2–4px only. No pills except the hero chip.
- No gradients, no glassmorphism, no emoji. Stars (`★`) are allowed as ornaments only.

---

## 3. Page structure (in order)

1. **Top bar** (sticky, navy) — brand + primary nav + **Sign in** + **Open field app**. Wire these two buttons to the *existing* auth handlers. Keep their exact colors: oxblood solid + ghost-on-navy outline.
2. **Hero** (navy) — H1 with italic oxblood emphasis, dual CTA (**Start free trial** → `/signup`, **See it in action** → `#how`), plus a product mock of the voter-roll admin screen.
3. **Trust strip** (parchment) — 4 stats: 347 campaigns / 1.2M doors / 28 states / 99.9% uptime. If real numbers are different, swap them — do not fabricate growth.
4. **How it works** (paper) — 3 steps matching the existing onboarding wizard routes (`/signup`, `/setup/*`, `/admin/voters`).
5. **Feature split 1 — Walkbooks** (parchment).
6. **Feature split 2 — AI** (paper, dark panel right).
7. **Pricing teaser** (parchment) — Starter / Pro / Agency. Each CTA links to `/signup?plan={starter|pro}` or `/contact?intent=agency`. Pro is the recommended tier (navy card + "Most chosen" ribbon).
8. **Testimonial** (navy) — Marcus Hallman quote (reused from existing deck).
9. **FAQ** (parchment) — 6 items, `<details>` accordion.
10. **Final CTA** (paper) — repeat of primary trial CTA + trust microlist.
11. **Footer** (parchment) — 4 columns.

---

## 4. Integration points

| Element | Current behavior to keep | Where to wire |
|---|---|---|
| `a[data-action="sign-in"]` | Existing Supabase login flow | Replace `<a href="/login">` with your `<Link>` to the login route that's already live |
| `a[data-action="open-field-app"]` | Existing session check → `/app` | Same — reuse your existing component |
| `.plan-cta` (Starter/Pro) | Must hit `/signup?plan=...` | Same `/signup` route from the onboarding handoff; `plan` query param preselects the Stripe price in the paywall step |
| `.plan-cta.ghost` (Agency) | Contact form | `/contact?intent=agency` |
| Hero primary CTA | Trial signup | `/signup` — no plan pre-selected |
| All internal anchors (`#how`, `#features`, `#pricing`, `#faq`) | Smooth scroll | Tailwind `scroll-smooth` on `<html>` |

---

## 5. Implementation notes for Claude Code

- **Do NOT rebuild auth.** The top-bar buttons are styling only — wrap your existing auth components in the same button classes.
- **Port to components**, one per top-level section: `<TopBar/>`, `<Hero/>`, `<TrustStrip/>`, `<HowItWorks/>`, `<FeatureWalkbooks/>`, `<FeatureAI/>`, `<PricingTeaser/>`, `<Testimonial/>`, `<FAQ/>`, `<FinalCTA/>`, `<Footer/>`.
- **Tailwind mapping:** extend `tailwind.config.ts` with the existing civic palette (already done in the onboarding handoff — import that config, don't fork it).
- **SEO:** `<title>Knock — Door-knock software for serious campaigns</title>`, meta description = hero subhead, `og:image` = screenshot of the hero at 1200×630 (generate from the HTML file).
- **A11y:** the hero mock has `role="img"` + `aria-label`; keep that on the React port. All icons decorative → `aria-hidden`.
- **Responsive:** collapses to single column at `max-width:960px` (see end of `<style>`). Mobile is supported but desktop-first — this is a B2B campaign-ops tool, 90% of traffic is desktop.
- **Performance:** no JS on this page other than `<details>` native. Preload Source Serif 4 + Inter from Google Fonts. Lazy-load nothing; it's one fold.
- **Tracking:** add one analytics call per CTA click (`signup_cta_clicked`, `pricing_cta_clicked`, `signin_clicked`). Use whatever's already wired.

---

## 6. Copy — do not change without approval

Exact H1, subheads, testimonial, and FAQ copy in the HTML are approved. Changing them requires a ping.

---

## 7. Open questions for the PM before shipping

1. Are the trust-strip numbers (347 / 1.2M / 28 / 99.9%) accurate? If no, replace or remove the strip.
2. Is the Marcus Hallman testimonial cleared for public marketing use?
3. Should we link the hero mock to a `/demo` route or keep it static?
4. Is the 14-day trial / no-card-required promise current?

---

## 8. Acceptance checklist

- [ ] Top-bar Sign in & Open field app use the existing auth, visually unchanged.
- [ ] All CTAs route into the existing `/signup` funnel with the correct `?plan=` param.
- [ ] Lighthouse: Performance ≥ 95, A11y ≥ 95, SEO ≥ 100 on desktop.
- [ ] No new colors, fonts, or radii outside the civic token set.
- [ ] Renders correctly at 1440, 1024, 768, 375.
- [ ] `/` is the default public route; authenticated users hitting `/` still see this page (don't auto-redirect to `/app`).
