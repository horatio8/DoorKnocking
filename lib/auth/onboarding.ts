import { redirect } from "next/navigation";
import { loadSession, type ActiveSession } from "@/lib/auth/session";

// Knocker onboarding gate — call from any /app/* page that should not be
// reachable until the welcome cards and GPS consent have been completed.
// Admins / super-admins pass through.
//
// Returns the resolved session (so callers don't need to await twice).
export async function requireOnboardedKnocker(): Promise<ActiveSession> {
  const session = await loadSession();
  if (!session) redirect("/login");
  // Everyone must set their own password before the app unlocks.
  if (session.user.must_change_password) redirect("/set-password");
  if (session.user.role === "knocker") {
    if (!session.user.completed_welcome_at) redirect("/app/welcome");
    if (!session.user.gps_consent) redirect("/app/gps-consent");
  }
  return session;
}
