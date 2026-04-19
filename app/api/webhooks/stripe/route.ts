import { NextResponse } from "next/server";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { verifyWebhookSignature } from "@/lib/billing/stripe";

// POST /api/webhooks/stripe
// Signed webhook receiver. Handles the subset we need for the onboarding flow:
//   - checkout.session.completed  → seed subscriptions + stamp users.stripe_customer_id
//   - customer.subscription.updated → status/plan/period transitions
//   - customer.subscription.deleted → status=canceled
//   - invoice.paid / invoice.payment_failed → rows in public.invoices
//
// The raw body is needed for signature verification, so Next's auto-parse is
// disabled via the route segment config below.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    // Keep the endpoint healthy in deploys without billing wired up yet.
    return NextResponse.json({ ok: true, skipped: "no secret" });
  }

  const raw = await req.text();
  try {
    await verifyWebhookSignature({
      rawBody: raw,
      header: req.headers.get("stripe-signature"),
      secret,
    });
  } catch (err) {
    console.error("stripe webhook: signature failure", err);
    return NextResponse.json({ error: "bad signature" }, { status: 400 });
  }

  let event: { id: string; type: string; data: { object: Record<string, unknown> } };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const supabase = getSupabaseServiceRoleClient();
  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object as {
          id: string;
          customer: string | null;
          subscription: string | null;
          customer_email: string | null;
          metadata?: { client_id?: string; plan_id?: string };
        };
        const clientId = s.metadata?.client_id ?? null;
        const planId = s.metadata?.plan_id ?? null;

        if (s.customer && s.customer_email) {
          await supabase
            .from("users")
            .update({ stripe_customer_id: s.customer })
            .eq("email", s.customer_email.toLowerCase());
        }

        if (s.subscription && clientId && planId) {
          await supabase.from("subscriptions").upsert(
            {
              client_id: clientId,
              user_id: null as unknown as string, // backfilled from users.email lookup if needed
              plan_id: planId,
              interval: "annual", // Stripe rotates this; real value comes via subscription.updated
              status: "trialing",
              stripe_subscription_id: s.subscription,
              stripe_customer_id: s.customer ?? null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "stripe_subscription_id" },
          );
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.created": {
        const s = event.data.object as {
          id: string;
          customer: string;
          status: string;
          current_period_start: number | null;
          current_period_end: number | null;
          trial_end: number | null;
          cancel_at_period_end: boolean;
          canceled_at: number | null;
          items?: { data?: Array<{ plan?: { interval?: string; id?: string } }> };
          metadata?: { client_id?: string; plan_id?: string };
        };
        const interval = s.items?.data?.[0]?.plan?.interval === "year" ? "annual" : "monthly";
        const iso = (t: number | null) => (t ? new Date(t * 1000).toISOString() : null);
        await supabase
          .from("subscriptions")
          .update({
            status: s.status,
            interval,
            current_period_start: iso(s.current_period_start),
            current_period_end: iso(s.current_period_end),
            trial_end: iso(s.trial_end),
            canceled_at: iso(s.canceled_at),
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_subscription_id", s.id);
        break;
      }
      case "customer.subscription.deleted": {
        const s = event.data.object as { id: string; canceled_at: number | null };
        await supabase
          .from("subscriptions")
          .update({
            status: "canceled",
            canceled_at: s.canceled_at
              ? new Date(s.canceled_at * 1000).toISOString()
              : new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_subscription_id", s.id);
        break;
      }
      case "invoice.paid":
      case "invoice.payment_failed": {
        const inv = event.data.object as {
          id: string;
          customer: string | null;
          subscription: string | null;
          number: string | null;
          amount_paid?: number;
          amount_due?: number;
          currency: string;
          status: string;
          description: string | null;
          hosted_invoice_url: string | null;
          invoice_pdf: string | null;
          status_transitions?: { paid_at?: number | null };
          metadata?: { client_id?: string };
        };
        const clientId = inv.metadata?.client_id ?? null;
        const { data: sub } = inv.subscription
          ? await supabase
              .from("subscriptions")
              .select("id, client_id")
              .eq("stripe_subscription_id", inv.subscription)
              .maybeSingle()
          : { data: null as null };
        const resolvedClient =
          clientId ?? (sub as { client_id: string } | null)?.client_id ?? null;

        await supabase.from("invoices").upsert(
          {
            subscription_id: (sub as { id: string } | null)?.id ?? null,
            client_id: resolvedClient,
            stripe_invoice_id: inv.id,
            number: inv.number,
            amount_cents: inv.amount_paid ?? inv.amount_due ?? 0,
            currency: inv.currency,
            status: inv.status,
            description: inv.description,
            hosted_invoice_url: inv.hosted_invoice_url,
            pdf_url: inv.invoice_pdf,
            paid_at: inv.status_transitions?.paid_at
              ? new Date(inv.status_transitions.paid_at * 1000).toISOString()
              : null,
          },
          { onConflict: "stripe_invoice_id" },
        );
        break;
      }
      default:
        // no-op for other events
        break;
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("stripe webhook handler failed", event?.type, err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
