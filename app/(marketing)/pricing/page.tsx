import type { Metadata } from "next";
import { PricingView } from "@/components/marketing/pricing-view";

export const metadata: Metadata = {
  title: "Pricing — Campaign OS",
  description:
    "Honest pricing for serious campaigns. Fourteen days free. No credit card until the last day of your trial.",
};

export default function PricingPage() {
  return <PricingView />;
}
