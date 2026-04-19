import { redirect } from "next/navigation";

// Promoted to /billing/activate (real Stripe Checkout entry point).
export default function DemoPaywallARedirect() {
  redirect("/billing/activate");
}
