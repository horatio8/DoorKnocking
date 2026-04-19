import { redirect } from "next/navigation";

// Promoted to /admin/internal/signup-funnel (admin-gated route).
export default function DemoFunnelRedirect() {
  redirect("/admin/internal/signup-funnel");
}
