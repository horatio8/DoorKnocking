import type { Metadata } from "next";
import Link from "next/link";
import { loadSession } from "@/lib/auth/session";
import { PaywallActivate } from "@/components/marketing/paywall-activate";

export const metadata: Metadata = { title: "Activate your plan — Campaign OS" };

// 08 · Real /billing/activate route. Trial-ended users land here via the
// AdminLayout gate; in-trial users can also reach it from the banner.

export default async function BillingActivatePage() {
  const session = await loadSession();
  if (!session) {
    return (
      <div className="min-h-screen bg-parchment px-8 py-16 text-center">
        <p className="text-civic-navy">
          <Link href="/login" className="underline">
            Log in
          </Link>{" "}
          to activate your plan.
        </p>
      </div>
    );
  }
  return <PaywallActivate planName={session.user.signup_plan ?? "Pro"} />;
}
