import { NextResponse } from "next/server";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { createCheckoutSession, priceIdFor, stripeEnabled } from "@/lib/billing/stripe";

// POST /api/billing/checkout
// Body: { plan: 'starter'|'pro', interval: 'monthly'|'annual', clientId }
// Creates a Stripe Checkout session and returns { url } for client-side redirect.

export async function POST(req: Request) {
  const session = await loadSession();
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  if (!stripeEnabled()) {
    return NextResponse.json(
      { error: "billing_disabled", message: "STRIPE_SECRET_KEY is not set on this deploy." },
      { status: 501 },
    );
  }

  const { plan, interval, clientId } = (await req.json().catch(() => ({}))) as {
    plan?: string;
    interval?: "monthly" | "annual";
    clientId?: string;
  };
  if (!plan || !interval) {
    return NextResponse.json({ error: "plan and interval required" }, { status: 400 });
  }
  const priceId = priceIdFor(plan, interval);
  if (!priceId) {
    return NextResponse.json(
      { error: "no_price", message: `STRIPE_PRICE_MAP missing ${plan}_${interval}` },
      { status: 500 },
    );
  }

  const service = getSupabaseServiceRoleClient();
  const { data: prof } = await service
    .from("users")
    .select("stripe_customer_id, email, client_access")
    .eq("id", session.user.id)
    .maybeSingle();
  const profile = prof as {
    stripe_customer_id: string | null;
    email: string;
    client_access: string[] | null;
  } | null;
  const resolvedClientId = clientId ?? profile?.client_access?.[0] ?? null;
  if (!resolvedClientId) {
    return NextResponse.json({ error: "no client on user" }, { status: 400 });
  }

  const origin =
    req.headers.get("origin") ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000";
  try {
    const sessionResp = await createCheckoutSession({
      priceId,
      customerEmail: profile?.email ?? session.user.email ?? null,
      customerId: profile?.stripe_customer_id ?? null,
      clientId: resolvedClientId,
      planId: plan,
      successUrl: `${origin}/admin?checkout=success`,
      cancelUrl: `${origin}/demo/paywall/a?checkout=cancelled`,
      trialDays: 14,
    });
    return NextResponse.json({ url: sessionResp.url });
  } catch (err) {
    console.error("stripe checkout failed", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
