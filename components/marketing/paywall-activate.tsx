"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CampaignOSMark } from "./campaign-os-mark";
import { CivicButton } from "./civic-button";
import {
  CivicField,
  CivicInput,
  CivicLabel,
  CivicSelect,
} from "./civic-input";
import { CivicCheckbox } from "./civic-check";
import { Eyebrow } from "./eyebrow";
import { StripeCardInput } from "./stripe-card-input";
import { trackFunnel } from "@/lib/marketing/funnel";

// Real paywall (promoted from /demo/paywall/a). CTA redirects through Stripe
// Checkout. Gracefully surfaces "Billing isn't live yet" when env vars are
// missing so preview deploys don't wedge users on this screen.

const PLAN_PRICES: Record<string, { monthly: number; annual: number }> = {
  starter: { monthly: 49, annual: 490 },
  pro: { monthly: 199, annual: 1990 },
};

export function PaywallActivate({ planName }: { planName: string }) {
  const planKey = planName.toLowerCase();
  const pricing = PLAN_PRICES[planKey] ?? PLAN_PRICES.pro!;
  const [interval, setInterval] = useState<"monthly" | "annual">("annual");
  const [receipt, setReceipt] = useState(true);
  const [name, setName] = useState("");
  const [zip, setZip] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    trackFunnel("paywall_viewed", { plan: planKey, interval });
  }, [planKey, interval]);

  async function startCheckout() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planKey, interval }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(
          body.error === "billing_disabled"
            ? "Billing isn't live on this deploy yet. Ask an admin to set STRIPE_SECRET_KEY."
            : body.message ?? body.error ?? `${res.status}`,
        );
        setBusy(false);
        return;
      }
      trackFunnel("paywall_completed", { plan: planKey, interval });
      window.location.href = body.url;
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const price = interval === "annual" ? Math.round(pricing.annual / 12) : pricing.monthly;
  const firstCharge =
    interval === "annual" ? `$${pricing.annual.toLocaleString()}.00` : `$${pricing.monthly}.00`;

  return (
    <div className="min-h-screen bg-parchment px-4 py-8 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-[520px]">
        <div className="mb-7 text-center">
          <div className="mb-5 inline-flex items-center gap-2 text-civic-navy">
            <CampaignOSMark size={22} />
            <span className="font-serif text-[15px] font-semibold">Campaign OS</span>
          </div>
          <Eyebrow variant="oxblood" className="mb-2.5 block">
            ★ Activate your plan ★
          </Eyebrow>
          <h1 className="mb-2.5 font-serif text-[32px] font-semibold leading-[1.1] tracking-[-0.01em] text-civic-navy">
            Ready to canvass for real?
          </h1>
          <p className="mx-auto max-w-[420px] text-[15px] text-ink-2">
            Add a card now to lift the 100-voter cap. We won&rsquo;t charge until your trial
            ends.
          </p>
        </div>

        <div className="border border-rule bg-white px-5 py-6 sm:px-8 sm:py-7">
          <div className="mb-6 border border-rule-2 bg-parchment p-[18px]">
            <div className="mb-2.5 flex items-baseline justify-between gap-4">
              <div>
                <Eyebrow variant="oxblood">Your plan</Eyebrow>
                <div className="mt-0.5 font-serif text-[22px] font-semibold text-civic-navy">
                  {planName} · {interval === "annual" ? "Annual" : "Monthly"}
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono text-2xl font-medium tabular-nums text-civic-navy">
                  ${price}
                </div>
                <div className="text-[11px] text-mute">
                  /{interval === "annual" ? "mo · billed yearly" : "month"}
                </div>
              </div>
            </div>

            <div className="mb-2 flex gap-1 text-xs">
              {(["monthly", "annual"] as const).map((v) => {
                const active = interval === v;
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setInterval(v)}
                    className={`flex-1 rounded-sm border px-2 py-1 font-semibold uppercase tracking-[0.08em] ${
                      active
                        ? "border-civic-navy bg-civic-navy text-parchment"
                        : "border-rule bg-white text-mute"
                    }`}
                  >
                    {v}
                    {v === "annual" ? (
                      <span className={`ml-1 text-[10px] ${active ? "text-parchment" : "text-oxblood"}`}>
                        −17%
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            <hr className="my-2.5 border-0 border-t border-rule" />
            <div className="flex items-center justify-between text-[12.5px] text-ink-2">
              <span>Today</span>
              <span className="font-mono font-semibold tabular-nums">$0.00</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[12.5px] text-ink-2">
              <span>
                First charge when trial ends
              </span>
              <span className="font-mono font-semibold tabular-nums">{firstCharge}</span>
            </div>
          </div>

          <CivicField>
            <CivicLabel>
              Card details
              <span className="ml-1.5 inline-flex items-center gap-1 font-sans text-[10px] font-normal normal-case tracking-normal text-mute">
                <LockIcon className="h-3 w-3 text-civic-navy" /> Stripe-secured
              </span>
            </CivicLabel>
            <StripeCardInput />
          </CivicField>
          <CivicField>
            <CivicLabel htmlFor="name-card">Name on card</CivicLabel>
            <CivicInput
              id="name-card"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="As it appears on the card"
            />
          </CivicField>
          <div className="grid grid-cols-[2fr_1fr] gap-3">
            <CivicField>
              <CivicLabel htmlFor="country">Country</CivicLabel>
              <CivicSelect id="country" defaultValue="United States">
                <option>United States</option>
              </CivicSelect>
            </CivicField>
            <CivicField>
              <CivicLabel htmlFor="zip">ZIP</CivicLabel>
              <CivicInput
                id="zip"
                value={zip}
                onChange={(e) => setZip(e.target.value)}
                inputMode="numeric"
                className="font-mono tabular-nums"
              />
            </CivicField>
          </div>

          <CivicCheckbox
            id="receipt"
            checked={receipt}
            onCheckedChange={setReceipt}
            className="mb-5 mt-1"
          >
            Email me a receipt each billing cycle.
          </CivicCheckbox>

          <CivicButton
            variant="primary"
            size="lg"
            className="w-full"
            onClick={startCheckout}
            disabled={busy}
          >
            <LockIcon className="h-4 w-4" />{" "}
            {busy ? "Connecting to Stripe…" : `Start my ${planName} plan`}
          </CivicButton>
          {error ? (
            <p className="mt-2 rounded-sm bg-oxblood/10 px-3 py-2 text-xs text-oxblood">
              {error}
            </p>
          ) : null}

          <p className="mt-4 text-center text-xs text-mute">
            Stripe handles the card. Campaign OS never sees it. Receipt email can be changed
            in Billing settings.
          </p>
        </div>

        <p className="mt-5 text-center text-[13px] text-mute">
          <Link
            href="/admin"
            onClick={() => trackFunnel("paywall_skipped", { plan: planKey })}
            className="no-underline hover:text-oxblood"
          >
            Not right now — keep exploring →
          </Link>
        </p>
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
