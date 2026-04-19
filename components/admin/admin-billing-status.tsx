import Link from "next/link";
import type { BillingState } from "@/lib/billing/trial";

// Top-of-admin banner. Shows the right piece of chrome based on billing
// state: trialing → parchment "X days remaining"; past_due / unpaid →
// amber warn-strip; trialEnded but has_card → nothing; active paid → nothing.

export function AdminBillingStatus({ billing }: { billing: BillingState }) {
  if (billing.subscriptionStatus === "past_due" || billing.subscriptionStatus === "unpaid") {
    return (
      <div
        className="flex flex-wrap items-center justify-between gap-4 border-b px-6 py-2.5 text-sm"
        style={{ backgroundColor: "#FBF3D9", borderBottomColor: "#DBC789", color: "#1A1817" }}
      >
        <div className="flex items-center gap-2.5">
          <WarnIcon className="h-4 w-4" style={{ color: "#8A6A1B" }} />
          <span>
            <strong>Payment failed.</strong> We&rsquo;ll retry your card shortly. Update your
            payment method to avoid service interruption.
          </span>
        </div>
        <Link
          href="/billing/activate"
          className="inline-flex items-center gap-1 rounded-sm border border-oxblood bg-oxblood px-3 py-1.5 text-xs font-semibold text-parchment hover:bg-oxblood-2"
        >
          Update card →
        </Link>
      </div>
    );
  }

  if (billing.trialEndsAt && !billing.trialEnded && !billing.hasPaymentMethod) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-rule bg-parchment px-6 py-2.5 text-sm">
        <div className="flex items-center gap-2.5">
          <span className="text-[9px] tracking-[0.3em] text-oxblood">★★★</span>
          <span className="text-ink-2">
            You&rsquo;re on a <strong className="text-civic-navy">14-day free trial</strong> ·{" "}
            <span className="font-mono tabular-nums">{billing.trialDaysLeft} days</span>{" "}
            remaining · Import up to 100 voters before adding a card.
          </span>
        </div>
        <Link
          href="/billing/activate"
          className="inline-flex items-center gap-1 rounded-sm border border-oxblood bg-oxblood px-3 py-1.5 text-xs font-semibold text-parchment hover:bg-oxblood-2"
        >
          Add card &amp; unlock →
        </Link>
      </div>
    );
  }

  // Active paid / no trial info / trial ended but card on file → no banner.
  return null;
}

function WarnIcon(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.3} aria-hidden {...p}>
      <path d="M8 2l6.5 11.5h-13z" />
      <path d="M8 6.5v3.5M8 11.8v.2" />
    </svg>
  );
}
