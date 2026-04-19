import type { Metadata } from "next";
import { SignupView } from "@/components/marketing/signup-view";
import { PLANS } from "@/lib/marketing/pricing-data";

export const metadata: Metadata = {
  title: "Start your trial — Campaign OS",
  description: "Start your 14-day free trial. No credit card until the last day.",
};

export default function SignupPage({
  searchParams,
}: {
  searchParams?: { plan?: string };
}) {
  const tier = searchParams?.plan ?? "pro";
  const plan = PLANS.find((p) => p.tier === tier) ?? PLANS.find((p) => p.tier === "pro")!;
  return <SignupView planName={plan.name} />;
}
