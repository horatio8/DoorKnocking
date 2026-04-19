import type { Metadata } from "next";
import Link from "next/link";
import { CampaignOSMark } from "@/components/marketing/campaign-os-mark";
import { CivicButton } from "@/components/marketing/civic-button";
import {
  CivicField,
  CivicInput,
  CivicLabel,
  CivicSelect,
} from "@/components/marketing/civic-input";
import { Eyebrow } from "@/components/marketing/eyebrow";
import { CheckIcon, ShieldIcon } from "@/components/marketing/civic-icons";
import { StripeCardInput } from "@/components/marketing/stripe-card-input";
import { CheckoutButton } from "@/components/marketing/checkout-button";

export const metadata: Metadata = { title: "Activate — Campaign OS" };

// Variation B — "the receipt". Dense two-column invoice-style paywall.
// Left: numbered form sections. Right: parchment receipt pane with
// line-items, double-rule, due-today, first-charge, and order # dashed
// footer. See handoff README §09.

const INCLUDED = [
  "1 district, 20 volunteer seats",
  "10,000 doors per cycle",
  "All AI features",
  "1,000 minutes transcription",
  "Priority email support",
];

export default function PaywallB() {
  return (
    <div className="min-h-screen bg-paper px-8 py-8">
      <div className="mx-auto max-w-[960px]">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/pricing" className="flex items-center gap-2 text-civic-navy no-underline">
            <CampaignOSMark size={22} />
            <span className="font-serif text-[15px] font-semibold">Campaign OS</span>
          </Link>
          <span className="text-xs text-mute">
            Secure checkout via <strong className="text-civic-navy">Stripe</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 border border-rule bg-white md:grid-cols-[1fr_420px]">
          {/* LEFT — form */}
          <div className="px-10 py-9">
            <Eyebrow variant="oxblood" className="mb-2.5 block">
              Activate
            </Eyebrow>
            <h2 className="mb-1.5 font-serif text-[26px] font-semibold leading-[1.1] tracking-[-0.01em] text-civic-navy">
              Start your Pro plan.
            </h2>
            <p className="mb-7 text-sm text-mute">
              Your 14-day trial stays active. First charge on{" "}
              <strong className="text-civic-navy">May 3, 2026</strong>.
            </p>

            <Eyebrow className="mb-3 block">1 · Card</Eyebrow>
            <StripeCardInput />

            <CivicField className="mt-4">
              <CivicLabel htmlFor="cardholder">Cardholder name</CivicLabel>
              <CivicInput id="cardholder" defaultValue="James E. Sprouse" />
            </CivicField>

            <Eyebrow className="mb-3 mt-4 block">2 · Billing address</Eyebrow>
            <CivicField>
              <CivicInput defaultValue="127 Queen Street" aria-label="Street" />
            </CivicField>
            <div className="mb-6 grid grid-cols-[1.2fr_1fr_0.8fr] gap-3">
              <CivicInput defaultValue="Charleston" placeholder="City" aria-label="City" />
              <CivicSelect defaultValue="SC" aria-label="State">
                <option>SC</option>
                <option>NC</option>
                <option>GA</option>
                <option>VA</option>
              </CivicSelect>
              <CivicInput
                defaultValue="29401"
                placeholder="ZIP"
                aria-label="ZIP"
                inputMode="numeric"
                className="font-mono tabular-nums"
              />
            </div>

            <div className="mb-5 flex items-start gap-2.5 border border-rule-2 bg-parchment px-3.5 py-3 text-[12.5px] text-ink-2">
              <ShieldIcon className="mt-0.5 h-4 w-4 flex-none text-civic-navy" />
              <span>
                Card data flows directly to Stripe (PCI-DSS). Campaign OS never sees your number.
                Billing receipts are emailed and archived under Settings → Billing.
              </span>
            </div>

            <CheckoutButton plan="pro" interval="annual" label="Confirm & start Pro" />
            <p className="mt-2 text-center text-[11px] text-mute">
              Routes through the real Stripe Checkout endpoint — graceful 501 if
              STRIPE_SECRET_KEY isn&rsquo;t set.
            </p>
            <p className="mt-2.5 text-center text-xs text-mute">
              <Link href="/demo/voters" className="hover:text-oxblood">
                ← Not right now, keep exploring
              </Link>
            </p>
          </div>

          {/* RIGHT — receipt pane */}
          <div className="border-t border-rule bg-parchment px-9 py-9 md:border-l md:border-t-0">
            <Eyebrow className="mb-3 block">Order summary</Eyebrow>
            <div className="mb-3.5 font-serif text-[22px] font-semibold text-civic-navy">
              Pro — Annual
            </div>

            <table className="mb-5 w-full text-[13px]">
              <tbody>
                <tr>
                  <td className="py-2">Pro plan · annual</td>
                  <td className="py-2 text-right font-mono tabular-nums">$1,990.00</td>
                </tr>
                <tr className="text-oxblood">
                  <td className="py-2">Annual discount (17%)</td>
                  <td className="py-2 text-right font-mono tabular-nums">− $398.00</td>
                </tr>
                <tr>
                  <td className="py-2">Stripe Tax (SC, est.)</td>
                  <td className="py-2 text-right font-mono tabular-nums">$0.00</td>
                </tr>
              </tbody>
            </table>

            <hr className="border-0 border-t-[3px] border-double border-rule-dark" />

            <div className="my-4 flex items-baseline justify-between gap-4">
              <div>
                <div className="text-xs text-mute">Due today</div>
                <div className="font-serif font-mono text-[30px] font-semibold tabular-nums text-civic-navy">
                  $0.00
                </div>
              </div>
              <div className="text-right">
                <Eyebrow>First charge</Eyebrow>
                <div className="font-mono text-sm font-semibold tabular-nums text-ink">
                  $1,990 · May 3
                </div>
              </div>
            </div>

            <hr className="border-0 border-t border-rule" />

            <Eyebrow className="mb-2.5 mt-6 block">Included</Eyebrow>
            <ul className="grid gap-2 text-[13px]">
              {INCLUDED.map((x) => (
                <li key={x} className="flex items-start gap-2">
                  <CheckIcon className="mt-0.5 h-4 w-4 flex-none text-oxblood" />
                  <span className="text-ink-2">{x}</span>
                </li>
              ))}
            </ul>

            <div className="mt-6 border-t border-dashed border-rule pt-4 text-[11px] text-mute">
              <div className="mb-1 font-mono tabular-nums">ORDER #COS-2026-0043</div>
              30-day money-back guarantee on annual plans. Cancel any time in Settings → Billing.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LockIcon(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.3} aria-hidden {...p}>
      <rect x="3" y="7" width="10" height="7" rx="0.5" />
      <path d="M5 7V5a3 3 0 016 0v2" />
    </svg>
  );
}
