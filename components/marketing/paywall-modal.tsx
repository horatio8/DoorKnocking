"use client";

import { useRouter } from "next/navigation";
import { CivicButton } from "./civic-button";
import { CivicField, CivicInput, CivicLabel } from "./civic-input";
import { Eyebrow } from "./eyebrow";
import { ShieldIcon, XIcon } from "./civic-icons";
import { StripeCardInput } from "./stripe-card-input";

// Modal body for paywall C. Extracted so the page can stay server-rendered
// while the interactive modal lives in its own client island.
export function PaywallModal() {
  const router = useRouter();

  return (
    <div className="absolute inset-0 flex items-center justify-center p-6">
      <div className="grid w-full max-w-[780px] grid-cols-1 border border-rule-dark bg-paper shadow-[0_40px_80px_-20px_rgba(0,0,0,0.4)] md:grid-cols-[280px_1fr]">
        {/* Side rail — plan selection */}
        <div className="relative bg-civic-navy px-6 py-7 text-parchment">
          <Eyebrow variant="on-navy" className="mb-3 block">
            Select your plan
          </Eyebrow>
          <div className="grid gap-2.5">
            <div className="border border-parchment/30 p-3.5 opacity-55">
              <div className="flex items-baseline justify-between">
                <span className="font-serif text-[17px] font-semibold">Starter</span>
                <span className="font-mono text-[13px] tabular-nums">$49/mo</span>
              </div>
              <div className="mt-1 text-[11px] text-parchment/60">1k doors · 5 volunteers</div>
            </div>
            <div className="relative border-[1.5px] border-oxblood bg-oxblood/15 p-3.5">
              <div className="absolute -top-2 right-2.5 bg-oxblood px-1.5 py-[1px] text-[9px] font-semibold tracking-[0.1em] text-parchment">
                SELECTED
              </div>
              <div className="flex items-baseline justify-between">
                <span className="font-serif text-[17px] font-semibold">Pro</span>
                <span className="font-mono text-[13px] tabular-nums">$199/mo</span>
              </div>
              <div className="mt-1 text-[11px] text-parchment/75">
                10k doors · 20 volunteers · all AI
              </div>
            </div>
          </div>

          <div className="mt-5 border-t border-parchment/15 pt-4">
            <Eyebrow variant="on-navy" className="mb-2.5 block">
              Billing
            </Eyebrow>
            <div className="flex border border-parchment/25 text-xs">
              <button
                type="button"
                className="flex-1 bg-transparent px-2 py-2 font-sans text-parchment/60"
              >
                Monthly
              </button>
              <button
                type="button"
                className="flex-1 bg-parchment px-2 py-2 font-sans font-semibold text-civic-navy"
              >
                Annual · −17%
              </button>
            </div>
          </div>

          <div className="absolute bottom-6 left-6 right-6 text-[11px] text-parchment/50">
            Your 14-day trial continues.
            <br />
            First charge: <strong className="text-parchment">May 3, 2026</strong>.
          </div>
        </div>

        {/* Form */}
        <div className="px-8 py-7">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-serif text-[22px] font-semibold leading-[1.1] tracking-[-0.01em] text-civic-navy">
              One more step.
            </h3>
            <button
              type="button"
              aria-label="Close"
              onClick={() => router.push("/demo/voters")}
              className="p-1 text-mute hover:text-civic-navy"
            >
              <XIcon className="h-[18px] w-[18px]" />
            </button>
          </div>
          <p className="mb-5 text-[13.5px] text-mute">
            Import voter files, generate walkbooks, invite your full team — all unlocked as soon
            as your card is on file.
          </p>

          <CivicField>
            <CivicLabel>Card</CivicLabel>
            <StripeCardInput />
          </CivicField>
          <CivicField>
            <CivicLabel>Name &amp; ZIP</CivicLabel>
            <div className="grid grid-cols-[2fr_1fr] gap-2">
              <CivicInput defaultValue="James E. Sprouse" aria-label="Name" />
              <CivicInput
                defaultValue="29401"
                aria-label="ZIP"
                inputMode="numeric"
                className="font-mono tabular-nums"
              />
            </div>
          </CivicField>

          <CivicButton variant="oxblood" size="lg" className="mt-2 w-full">
            Unlock Pro — $0 today
          </CivicButton>

          <div className="mt-3.5 flex items-center justify-between text-[11px] text-mute">
            <span className="inline-flex items-center gap-1.5">
              <ShieldIcon className="h-3.5 w-3.5 text-civic-navy" /> Stripe-secured
            </span>
            <span>30-day money-back · cancel in 1 click</span>
          </div>
        </div>
      </div>
    </div>
  );
}
