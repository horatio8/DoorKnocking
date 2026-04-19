import type { Metadata } from "next";
import { CivicAdminShell } from "@/components/marketing/civic-admin-shell";
import { CivicButton } from "@/components/marketing/civic-button";
import { CivicBadge } from "@/components/marketing/civic-badge";
import { Eyebrow } from "@/components/marketing/eyebrow";

export const metadata: Metadata = { title: "Payment issue — Campaign OS" };

// 13 · Dunning / payment-failed state. Amber banner, retry schedule chips,
// activity log. Per handoff README §13.

const RETRIES = [
  { date: "May 3", label: "Failed", status: "declined" as const, done: true },
  { date: "May 5", label: "Retry #1", status: "scheduled" as const, next: true },
  { date: "May 8", label: "Retry #2", status: "pending" as const },
];

const ACTIVITY = [
  ["May 3 · 09:12", "invoice.payment_failed", "card_declined: insufficient_funds"],
  ["May 3 · 09:12", "Email sent — \"Your payment failed\"", "james@teller.co"],
  ["May 3 · 09:12", "subscription.status = past_due", "automatic"],
];

function DunningBanner() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b px-6 py-2.5 text-sm text-ink"
      style={{ backgroundColor: "#FBF3D9", borderBottomColor: "#DBC789" }}
    >
      <div className="flex items-center gap-2.5">
        <WarnIcon className="h-4 w-4 text-civic-amber" />
        <span>
          <strong>Payment failed on May 3 — your card was declined.</strong> We&rsquo;ll retry on
          May 5. Until then you can keep working.
        </span>
      </div>
      <CivicButton variant="oxblood" size="sm">
        Update card →
      </CivicButton>
    </div>
  );
}

export default function DunningView() {
  return (
    <CivicAdminShell active="Billing" banner={<DunningBanner />} planBadge="PRO · PAST DUE">
      <div className="mb-6">
        <Eyebrow className="mb-1 block">Settings</Eyebrow>
        <h2 className="font-serif text-[28px] font-semibold leading-[1.1] tracking-[-0.01em] text-civic-navy">
          Billing &amp; Plan
        </h2>
      </div>

      <div
        className="mb-5 border bg-white p-6"
        style={{ borderColor: "var(--civic-amber, #8A6A1B)" }}
      >
        <div className="mb-3.5 flex items-start justify-between gap-4">
          <div>
            <Eyebrow className="mb-1.5 block text-civic-amber">Payment issue</Eyebrow>
            <div className="font-serif text-[22px] font-semibold leading-[1.1] text-civic-navy">
              We couldn&rsquo;t charge your card.
            </div>
            <p className="mt-2 max-w-[560px] text-sm text-ink-2">
              Stripe reported{" "}
              <span className="bg-parchment px-1.5 py-[1px] font-mono text-[12.5px]">
                card_declined: insufficient_funds
              </span>
              . We&rsquo;ll retry automatically on <strong>May 5</strong> and{" "}
              <strong>May 8</strong>. After May 17 your account moves to read-only.
            </p>
          </div>
          <CivicBadge variant="amber" solid dot>
            Past due
          </CivicBadge>
        </div>

        <hr className="my-4 border-0 border-t border-rule" />

        <Eyebrow className="mb-3 block">Retry schedule</Eyebrow>
        <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-3">
          {RETRIES.map((r) => (
            <div
              key={r.label}
              className={`border p-3.5 ${r.next ? "border-civic-navy bg-parchment" : "border-rule bg-white"}`}
            >
              <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-mute">
                {r.date}
              </div>
              <div className="mt-0.5 font-serif text-sm font-semibold">{r.label}</div>
              <div
                className={`mt-1 text-[11px] ${r.done ? "text-oxblood" : r.next ? "text-civic-navy" : "text-mute"}`}
              >
                {r.done ? "✕ Declined" : r.next ? "Scheduled" : "Pending"}
              </div>
            </div>
          ))}
        </div>

        <CivicButton variant="oxblood">Update payment method →</CivicButton>
        <CivicButton variant="link" className="ml-2">
          Contact support
        </CivicButton>
      </div>

      <div className="border border-rule bg-white p-5">
        <Eyebrow variant="oxblood" className="mb-1.5 block">
          Recent activity
        </Eyebrow>
        <ul className="grid gap-2.5 text-[13px]">
          {ACTIVITY.map((row, i) => (
            <li
              key={i}
              className="grid gap-3 border-b border-dashed border-rule-2 py-2 last:border-b-0 md:grid-cols-[130px_1fr_1fr]"
            >
              <span className="font-mono text-[11px] text-mute tabular-nums">{row[0]}</span>
              <span className="font-mono text-[11.5px]">{row[1]}</span>
              <span className="text-xs text-mute">{row[2]}</span>
            </li>
          ))}
        </ul>
      </div>
    </CivicAdminShell>
  );
}

function WarnIcon(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.3} aria-hidden {...p}>
      <path d="M8 2l6.5 11.5h-13z" />
      <path d="M8 6.5v3.5M8 11.8v.2" />
    </svg>
  );
}
