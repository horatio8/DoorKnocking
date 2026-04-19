import type { Metadata } from "next";
import Link from "next/link";
import { loadSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { getBillingState } from "@/lib/billing/trial";
import { CivicButton } from "@/components/marketing/civic-button";
import { CivicBadge } from "@/components/marketing/civic-badge";
import { Eyebrow } from "@/components/marketing/eyebrow";
import { PortalButton } from "@/components/admin/portal-button";

export const metadata: Metadata = { title: "Billing — Campaign OS" };
export const dynamic = "force-dynamic";

export default async function AdminBilling() {
  const session = await loadSession();
  if (!session) redirect("/login");

  const supabase = getSupabaseServiceRoleClient();
  const billing = await getBillingState();

  const { data: subRow } = await supabase
    .from("subscriptions")
    .select(
      "id, client_id, plan_id, interval, status, stripe_subscription_id, stripe_customer_id, current_period_start, current_period_end, trial_end, created_at",
    )
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sub = subRow as {
    id: string;
    client_id: string;
    plan_id: string;
    interval: "monthly" | "annual";
    status: string;
    current_period_start: string | null;
    current_period_end: string | null;
    trial_end: string | null;
    created_at: string;
  } | null;

  const { data: planRow } = sub
    ? await supabase
        .from("plans")
        .select("name, monthly_cents, annual_cents")
        .eq("id", sub.plan_id)
        .maybeSingle()
    : { data: null };
  const plan = planRow as {
    name: string;
    monthly_cents: number | null;
    annual_cents: number | null;
  } | null;

  const { data: invRows } = await supabase
    .from("invoices")
    .select("id, number, amount_cents, currency, status, description, paid_at, pdf_url, created_at")
    .eq("client_id", sub?.client_id ?? "00000000-0000-0000-0000-000000000000")
    .order("created_at", { ascending: false })
    .limit(12);
  const invoices = (invRows ?? []) as Array<{
    id: string;
    number: string | null;
    amount_cents: number;
    currency: string;
    status: string;
    description: string | null;
    paid_at: string | null;
    pdf_url: string | null;
    created_at: string;
  }>;

  const hasSubscription = Boolean(sub);
  const priceCents =
    sub && plan
      ? sub.interval === "annual"
        ? plan.annual_cents
        : plan.monthly_cents
      : null;
  const priceLabel = priceCents != null ? `$${(priceCents / 100).toLocaleString()}` : "—";
  const nextChargeLabel = sub?.current_period_end
    ? new Date(sub.current_period_end).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : sub?.trial_end
      ? new Date(sub.trial_end).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "—";
  const startedLabel = sub?.created_at
    ? new Date(sub.created_at).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";

  return (
    <div className="space-y-6">
      <div>
        <Eyebrow className="mb-1 block">Settings</Eyebrow>
        <h2 className="font-serif text-[28px] font-semibold leading-[1.1] tracking-[-0.01em] text-civic-navy">
          Billing &amp; Plan
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.4fr_1fr]">
        {/* Current plan */}
        <div className="border border-rule bg-white p-6">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <Eyebrow variant="oxblood" className="mb-1.5 block">
                Current plan
              </Eyebrow>
              <div className="font-serif text-[26px] font-semibold leading-[1.1] tracking-[-0.01em] text-civic-navy">
                {plan?.name ?? "No active plan"}
                {sub ? ` — ${sub.interval === "annual" ? "Annual" : "Monthly"}` : ""}
              </div>
              <p className="mt-0.5 text-[13px] text-mute">
                {sub
                  ? `Subscription since ${startedLabel}`
                  : billing.trialEndsAt
                    ? `Trial until ${billing.trialEndsAt.toLocaleDateString()}`
                    : "Start a trial from the pricing page"}
              </p>
            </div>
            <StatusBadge status={billing.subscriptionStatus} />
          </div>
          <div className="grid grid-cols-3 gap-5 border-y border-rule-2 py-4">
            <div>
              <Eyebrow className="mb-1 block">Price</Eyebrow>
              <div className="font-mono text-lg font-semibold tabular-nums text-civic-navy">
                {priceLabel}
                {sub ? (
                  <span className="text-xs font-normal text-mute">
                    /{sub.interval === "annual" ? "yr" : "mo"}
                  </span>
                ) : null}
              </div>
            </div>
            <div>
              <Eyebrow className="mb-1 block">Next charge</Eyebrow>
              <div className="font-mono text-sm font-semibold tabular-nums">
                {nextChargeLabel}
              </div>
            </div>
            <div>
              <Eyebrow className="mb-1 block">Started</Eyebrow>
              <div className="font-mono text-sm font-semibold tabular-nums">{startedLabel}</div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {hasSubscription ? (
              <PortalButton label="Change plan" variant="primary" />
            ) : (
              <CivicButton as="link" href="/billing/activate" variant="primary" size="sm">
                Start subscription
              </CivicButton>
            )}
            {hasSubscription ? <PortalButton label="Open Stripe portal ↗" variant="ghost" /> : null}
            {hasSubscription ? (
              <PortalButton
                label="Cancel subscription"
                variant="link"
                className="ml-auto text-xs"
              />
            ) : null}
          </div>
        </div>

        {/* Payment method */}
        <div className="border border-rule bg-white p-6">
          <Eyebrow variant="oxblood" className="mb-1.5 block">
            Payment method
          </Eyebrow>
          {billing.hasPaymentMethod ? (
            <>
              <div className="flex items-center gap-3.5 py-3.5">
                <div className="flex h-7 w-11 items-center justify-center border border-rule text-[10px] font-bold tracking-[0.1em] text-civic-navy">
                  CARD
                </div>
                <div>
                  <div className="font-mono text-sm font-medium tabular-nums">
                    •••• •••• •••• ••••
                  </div>
                  <div className="text-[11px] text-mute">
                    Managed in the Stripe customer portal
                  </div>
                </div>
              </div>
              <PortalButton label="Update payment method" variant="ghost" className="w-full" />
            </>
          ) : (
            <p className="py-6 text-center text-sm text-mute">
              No card on file yet.{" "}
              <Link
                href="/billing/activate"
                className="text-civic-navy underline underline-offset-[3px] hover:text-oxblood"
              >
                Add one →
              </Link>
            </p>
          )}
          <hr className="my-4 border-0 border-t border-rule" />
          <Eyebrow className="mb-1.5 block">Billing email</Eyebrow>
          <div className="font-mono text-[13px]">{session.user.email}</div>
        </div>
      </div>

      {/* Invoices */}
      <div className="border border-rule bg-white">
        <div className="flex items-center justify-between border-b border-rule-2 px-6 py-5">
          <div>
            <Eyebrow variant="oxblood">Invoices</Eyebrow>
            <div className="mt-1 font-serif text-lg font-semibold">Billing history</div>
          </div>
          {hasSubscription ? (
            <PortalButton label="Open in Stripe ↗" variant="ghost" />
          ) : null}
        </div>
        {invoices.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-mute">
            No invoices yet. Stripe will mirror invoices here once you activate a plan.
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-parchment">
              <tr className="text-[11px] uppercase tracking-[0.08em] text-mute">
                <th className="px-6 py-3 font-semibold">Invoice</th>
                <th className="px-3 py-3 font-semibold">Date</th>
                <th className="px-3 py-3 font-semibold">Description</th>
                <th className="px-3 py-3 font-semibold">Amount</th>
                <th className="px-3 py-3 font-semibold">Status</th>
                <th className="px-6 py-3 font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((row) => (
                <tr key={row.id} className="border-t border-rule-2">
                  <td className="px-6 py-3 font-mono tabular-nums">{row.number ?? row.id.slice(0, 8)}</td>
                  <td className="px-3 py-3">
                    {new Date(row.paid_at ?? row.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-3">{row.description ?? "—"}</td>
                  <td className="px-3 py-3 font-mono font-semibold tabular-nums">
                    ${(row.amount_cents / 100).toLocaleString()}
                  </td>
                  <td className="px-3 py-3">
                    <CivicBadge
                      variant={row.status === "paid" ? "green" : "amber"}
                      solid
                      dot
                    >
                      {row.status}
                    </CivicBadge>
                  </td>
                  <td className="px-6 py-3 text-right">
                    {row.pdf_url ? (
                      <a
                        href={row.pdf_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-civic-navy underline underline-offset-[3px] hover:text-oxblood"
                      >
                        ↓ PDF
                      </a>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "active")
    return (
      <CivicBadge variant="green" solid dot>
        Active
      </CivicBadge>
    );
  if (status === "trialing")
    return (
      <CivicBadge variant="navy" solid dot>
        Trialing
      </CivicBadge>
    );
  if (status === "past_due" || status === "unpaid")
    return (
      <CivicBadge variant="amber" solid dot>
        Past due
      </CivicBadge>
    );
  if (status === "canceled")
    return (
      <CivicBadge variant="oxblood" solid dot>
        Canceled
      </CivicBadge>
    );
  return (
    <CivicBadge variant="mute" solid dot>
      No plan
    </CivicBadge>
  );
}
