import { NextResponse } from "next/server";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { createBillingPortalSession, stripeEnabled } from "@/lib/billing/stripe";

// POST /api/billing/portal — redirect user to their Stripe Customer Portal.
// The billing page's "Open Stripe portal ↗" and Change plan / Cancel
// buttons all land here; Stripe handles the rest.

export async function POST(req: Request) {
  const session = await loadSession();
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!stripeEnabled()) {
    return NextResponse.json({ error: "billing_disabled" }, { status: 501 });
  }

  const service = getSupabaseServiceRoleClient();
  const { data: prof } = await service
    .from("users")
    .select("stripe_customer_id")
    .eq("id", session.user.id)
    .maybeSingle();
  const customerId = (prof as { stripe_customer_id: string | null } | null)?.stripe_customer_id;
  if (!customerId) return NextResponse.json({ error: "no stripe customer" }, { status: 400 });

  const origin =
    req.headers.get("origin") ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000";
  try {
    const portal = await createBillingPortalSession({
      customerId,
      returnUrl: `${origin}/admin/settings`,
    });
    return NextResponse.json({ url: portal.url });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
