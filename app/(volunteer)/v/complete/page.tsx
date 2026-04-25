import { redirect } from "next/navigation";
import { loadSession } from "@/lib/auth/session";
import { loadSessionSummary } from "@/lib/volunteer/load-summary";
import { CompleteClient } from "./complete-client";

export const dynamic = "force-dynamic";

// Screen 8 — Walkbook complete (Variant B, "Confetti hero")

export default async function CompletePage() {
  const session = await loadSession();
  if (!session) redirect("/login");

  const summary = await loadSessionSummary(session.user.id);
  const fullName = session.user.full_name ?? "";
  const firstName = (fullName.split(/\s+/)[0] || "there").trim();

  return <CompleteClient firstName={firstName} summary={summary} />;
}
