import { redirect } from "next/navigation";

// Promoted to /admin/billing (real subscriptions / invoices reads).
export default function DemoBillingRedirect() {
  redirect("/admin/billing");
}
