import type { Metadata } from "next";
import Link from "next/link";
import { CivicAdminShell } from "@/components/marketing/civic-admin-shell";
import { TrialBanner } from "@/components/marketing/trial-banner";
import { PaywallModal } from "@/components/marketing/paywall-modal";

export const metadata: Metadata = { title: "Activate — Campaign OS" };

// Variation C — "the inline moment". Paywall as a modal over the blurred
// empty dashboard. See handoff README §10.
export default function PaywallC() {
  return (
    <div className="relative min-h-screen">
      <div className="pointer-events-none blur-[2px] saturate-[0.8] opacity-55">
        <CivicAdminShell active="Voters" banner={<TrialBanner />}>
          <div className="h-[480px]" />
        </CivicAdminShell>
      </div>
      <div className="absolute inset-0 bg-civic-navy/55" />
      <PaywallModal />
      <noscript className="absolute bottom-4 left-4 text-xs text-parchment/60">
        <Link href="/demo/voters" className="underline">
          Close modal
        </Link>
      </noscript>
    </div>
  );
}
