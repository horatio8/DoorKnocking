# Multi-client deployment — DNS + Vercel

One Vercel project serves every client. Each client lives at their own
subdomain, resolved by the Next.js middleware at the edge.

```
apex                       app.campaignos.com   →  super-admin console (Teller)
wildcard subdomain         *.campaignos.com     →  per-client door-knock app
vercel preview             *.vercel.app         →  unscoped (dev only)
path-based (fallback)      /c/<slug>/...        →  same app, scoped
```

---

## 1. Register the parent domain

Buy `campaignos.com` (or similar) from Namecheap / Route 53 / Cloudflare.

## 2. Add domains in Vercel

Vercel dashboard → **door-knocking** project → **Settings** → **Domains**.

Add the following **three** entries:

| Domain | Purpose |
| --- | --- |
| `campaignos.com` | Apex — optional landing / marketing page |
| `*.campaignos.com` | Wildcard — every client's subdomain |
| `app.campaignos.com` | Super-admin console |

> Wildcard SSL is a **Pro plan** feature. You're already on Pro, so
> Vercel will issue a wildcard certificate automatically after DNS
> propagates.

## 3. DNS records

At your registrar, set these records:

| Type | Name | Value |
| --- | --- | --- |
| A | `@` | `76.76.21.21` |
| CNAME | `*` | `cname.vercel-dns.com` |
| CNAME | `app` | `cname.vercel-dns.com` |
| CNAME | `www` | `cname.vercel-dns.com` (optional) |

Propagation is usually 5–30 min; sometimes up to 24 hrs.

Verify with:
```bash
dig +short teller.campaignos.com
# should return a cname.vercel-dns.com CNAME → A record
```

## 4. Update Supabase Auth redirect URLs

Supabase Dashboard → **Authentication** → **URL Configuration**.

- **Site URL**: `https://app.campaignos.com`
- **Additional Redirect URLs** (one per line):
  ```
  https://app.campaignos.com
  https://*.campaignos.com
  https://*.campaignos.com/**
  ```

## 5. Cookie scope (session sharing)

To let Teller admins log in once and see any client they have access to,
cookies must be set on the parent domain. The `@supabase/ssr` server client
uses Next.js's cookie API which by default scopes to the request's host.
For cross-subdomain sessions, add a Supabase Auth cookie domain:

In Supabase Dashboard → **Authentication** → **Sessions**:
- **Cookie domain**: `.campaignos.com`
- **Cookie same-site**: `Lax`

This tells Supabase to write cookies to `.campaignos.com`, so the session
survives navigation from `app.campaignos.com` to `teller.campaignos.com`.

**Tradeoff:** any compromised subdomain can read the auth cookie. If you
need hard isolation between clients, omit this setting — users will log in
per subdomain.

## 6. Environment variables

In Vercel → **Settings → Environment Variables**, also add:

| Key | Value |
| --- | --- |
| `NEXT_PUBLIC_APP_URL` | `https://app.campaignos.com` |

The app uses this for invite-email redirect URLs and CSP allowlists.

## 7. Test

After DNS propagates and a redeploy:

1. `https://app.campaignos.com` → super-admin console.
2. `https://teller.campaignos.com` → logs you into the Teller client context
   (existing HD-115 data).
3. Create a new client via `/admin/clients` as a super-admin; a minute later
   the new subdomain should resolve.

## 8. Import voter files per client

Each new client's first district gets its voter file imported the same way:

```bash
AIRTABLE_API_KEY=... \
NEXT_PUBLIC_SUPABASE_URL=... \
SUPABASE_SERVICE_ROLE_KEY=... \
NEXT_PUBLIC_MAPBOX_TOKEN=... \
npm run import:district -- --district=<district-slug>
```

The script is client-agnostic — it finds the district by slug (globally unique)
and pulls from the Airtable base configured on that district row.
