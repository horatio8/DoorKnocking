"use client";

import { useState } from "react";
import { CivicButton } from "./civic-button";
import { trackFunnel } from "@/lib/marketing/funnel";

// Reusable "go to Stripe Checkout" button. Paywall A/B/C all share this —
// the only difference between the variants is visual layout.

function LockIcon(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.3} aria-hidden {...p}>
      <rect x="3" y="7" width="10" height="7" rx="0.5" />
      <path d="M5 7V5a3 3 0 016 0v2" />
    </svg>
  );
}

export function CheckoutButton({
  plan,
  interval,
  label,
  variant = "primary",
  size = "lg",
  className,
}: {
  plan: string;
  interval: "monthly" | "annual";
  label: string;
  variant?: "primary" | "oxblood" | "ghost";
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, interval }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(
          body.error === "billing_disabled"
            ? "Billing isn't live on this deploy yet."
            : body.message ?? body.error ?? `${res.status}`,
        );
        setBusy(false);
        return;
      }
      trackFunnel("paywall_completed", { plan, interval });
      window.location.href = body.url;
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className={className}>
      <CivicButton onClick={go} variant={variant} size={size} disabled={busy} className="w-full">
        <LockIcon className="h-4 w-4" /> {busy ? "Connecting…" : label}
      </CivicButton>
      {error ? (
        <p className="mt-2 rounded-sm bg-oxblood/10 px-3 py-2 text-xs text-oxblood">{error}</p>
      ) : null}
    </div>
  );
}
