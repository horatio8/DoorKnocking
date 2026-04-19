// Minimal Stripe REST client. We don't add the `stripe` SDK dependency here —
// all we need is Checkout Session creation + webhook signature verification,
// both of which are fine with fetch + HMAC. Swap to the SDK later if the flow
// grows (expanded resources, Connect, etc).

const API = "https://api.stripe.com/v1";

function creds() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  return key;
}

export function stripeEnabled(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

function form(obj: Record<string, string | number | boolean | undefined | null>): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    params.append(k, String(v));
  }
  return params.toString();
}

async function stripeRequest<T>(
  path: string,
  init: { method: "GET" | "POST"; body?: string },
): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${creds()}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: init.body,
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Stripe ${init.method} ${path} ${res.status}: ${detail}`);
  }
  return res.json() as Promise<T>;
}

export interface CheckoutSession {
  id: string;
  url: string;
  customer: string | null;
  subscription: string | null;
}

// Create a subscription-mode Checkout Session. We don't pass a price id here —
// the full plans↔price mapping lives in STRIPE_PRICE_MAP env (see
// docs/ONBOARDING-NEXT-STEPS.md).
export async function createCheckoutSession(opts: {
  priceId: string;
  customerEmail?: string | null;
  customerId?: string | null;
  clientId: string;
  planId: string;
  successUrl: string;
  cancelUrl: string;
  trialDays?: number;
}): Promise<CheckoutSession> {
  const body = form({
    mode: "subscription",
    "line_items[0][price]": opts.priceId,
    "line_items[0][quantity]": 1,
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    customer: opts.customerId ?? undefined,
    customer_email: opts.customerId ? undefined : opts.customerEmail ?? undefined,
    allow_promotion_codes: true,
    "metadata[client_id]": opts.clientId,
    "metadata[plan_id]": opts.planId,
    "subscription_data[trial_period_days]": opts.trialDays ?? 14,
    "subscription_data[metadata][client_id]": opts.clientId,
    "subscription_data[metadata][plan_id]": opts.planId,
  });
  return stripeRequest<CheckoutSession>("/checkout/sessions", { method: "POST", body });
}

export interface BillingPortalSession {
  id: string;
  url: string;
}
export async function createBillingPortalSession(opts: {
  customerId: string;
  returnUrl: string;
}): Promise<BillingPortalSession> {
  const body = form({ customer: opts.customerId, return_url: opts.returnUrl });
  return stripeRequest<BillingPortalSession>("/billing_portal/sessions", {
    method: "POST",
    body,
  });
}

// Verify a Stripe webhook signature using the scheme from
// https://stripe.com/docs/webhooks/signatures. Throws on mismatch.
export async function verifyWebhookSignature(opts: {
  rawBody: string;
  header: string | null;
  secret: string;
}): Promise<void> {
  if (!opts.header) throw new Error("missing stripe-signature");
  const parts = Object.fromEntries(
    opts.header.split(",").map((p) => {
      const [k, v] = p.split("=");
      return [k?.trim() ?? "", v?.trim() ?? ""];
    }),
  );
  const timestamp = parts.t;
  const expected = parts.v1;
  if (!timestamp || !expected) throw new Error("invalid stripe-signature format");

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(opts.secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(`${timestamp}.${opts.rawBody}`));
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  if (hex !== expected) throw new Error("signature mismatch");
}

// Env → plan mapping. Format: "starter_monthly=price_xxx,starter_annual=price_xxx,..."
// Keeps Stripe price ids out of the tree and lets you rotate them without a deploy.
export function priceIdFor(plan: string, interval: "monthly" | "annual"): string | null {
  const raw = process.env.STRIPE_PRICE_MAP ?? "";
  const map = new Map<string, string>();
  for (const part of raw.split(",")) {
    const [k, v] = part.split("=").map((s) => s.trim());
    if (k && v) map.set(k, v);
  }
  return map.get(`${plan}_${interval}`) ?? null;
}
