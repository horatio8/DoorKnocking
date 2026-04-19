"use client";

import { useState } from "react";
import { CivicButton } from "@/components/marketing/civic-button";
import { cn } from "@/lib/utils";

// Any billing button that should land the user in Stripe Customer Portal.
// Falls back to a toast if STRIPE_SECRET_KEY isn't set on this deploy.

export function PortalButton({
  label,
  variant = "ghost",
  size = "sm",
  className,
}: {
  label: string;
  variant?: "primary" | "oxblood" | "ghost" | "link";
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const body = await res.json();
      if (!res.ok) {
        setError(
          body.error === "billing_disabled"
            ? "Billing isn't live on this deploy yet."
            : body.error ?? `${res.status}`,
        );
        setBusy(false);
        return;
      }
      window.location.href = body.url;
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <span className={cn("inline-flex flex-col items-start", className)}>
      <CivicButton onClick={go} variant={variant} size={size} disabled={busy}>
        {busy ? "Opening…" : label}
      </CivicButton>
      {error ? (
        <span className="mt-1 text-[11px] text-oxblood">{error}</span>
      ) : null}
    </span>
  );
}
