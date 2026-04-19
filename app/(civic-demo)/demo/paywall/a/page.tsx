"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CampaignOSMark } from "@/components/marketing/campaign-os-mark";
import { CivicButton } from "@/components/marketing/civic-button";
import {
  CivicField,
  CivicInput,
  CivicLabel,
  CivicSelect,
} from "@/components/marketing/civic-input";
import { CivicCheckbox } from "@/components/marketing/civic-check";
import { Eyebrow } from "@/components/marketing/eyebrow";
import { StripeCardInput } from "@/components/marketing/stripe-card-input";
import { trackFunnel } from "@/lib/marketing/funnel";

// Variation A — default "respectful broadside". Parchment background,
// centered single column (max 520px), plan summary in parchment box, lock
// icon on CTA, muted skip link below. See handoff README §08.

export default function PaywallA() {
  const [receipt, setReceipt] = useState(true);
  const [name, setName] = useState("James E. Sprouse");
  const [zip, setZip] = useState("29401");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    trackFunnel("paywall_viewed", { variant: "a" });
  }, []);

  async function startCheckout() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "pro", interval: "annual" }),
      });
      const body = await res.json();
      if (!res.ok) {
        // Graceful fallback while Stripe isn't configured.
        if (body.error === "billing_disabled") {
          setError("Billing isn't live on this preview yet. See ONBOARDING-NEXT-STEPS.md.");
        } else {
          setError(body.message ?? body.error ?? `${res.status}`);
        }
        setBusy(false);
        return;
      }
      trackFunnel("paywall_completed", { variant: "a" });
      window.location.href = body.url;
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-parchment px-8 py-10">
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

        <div className="border border-rule bg-white px-8 py-7">
          {/* Summary */}
          <div className="mb-6 border border-rule-2 bg-parchment p-[18px]">
            <div className="mb-2.5 flex items-baseline justify-between gap-4">
              <div>
                <Eyebrow variant="oxblood">Your plan</Eyebrow>
                <div className="mt-0.5 font-serif text-[22px] font-semibold text-civic-navy">
                  Pro · Annual
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono text-2xl font-medium tabular-nums text-civic-navy">
                  $1,990
                </div>
                <div className="text-[11px] text-mute">per year · save $398</div>
              </div>
            </div>
            <hr className="my-2.5 border-0 border-t border-rule" />
            <div className="flex items-center justify-between text-[12.5px] text-ink-2">
              <span>Today</span>
              <span className="font-mono font-semibold tabular-nums">$0.00</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[12.5px] text-ink-2">
              <span>
                First charge on <strong className="text-civic-navy">May 3, 2026</strong>
              </span>
              <span className="font-mono font-semibold tabular-nums">$1,990.00</span>
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
            <CivicInput id="name-card" value={name} onChange={(e) => setName(e.target.value)} />
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
            <LockIcon className="h-4 w-4" /> {busy ? "Connecting…" : "Start my Pro plan"}
          </CivicButton>
          {error ? (
            <p className="mt-2 rounded-sm bg-oxblood/10 px-3 py-2 text-xs text-oxblood">
              {error}
            </p>
          ) : null}

          <p className="mt-4 text-center text-xs text-mute">
            <Link href="/pricing" className="mr-4 text-civic-navy underline underline-offset-[3px] hover:text-oxblood">
              Change plan
            </Link>
            <Link href="#" className="text-civic-navy underline underline-offset-[3px] hover:text-oxblood">
              Questions? Chat with us
            </Link>
          </p>
        </div>

        <p className="mt-5 text-center text-[13px] text-mute">
          <Link
            href="/demo/voters"
            onClick={() => trackFunnel("paywall_skipped", { variant: "a" })}
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
