import { redirect } from "next/navigation";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { getActiveClient } from "@/lib/clients/active";
import { WelcomeClient } from "./welcome-client";

export const dynamic = "force-dynamic";

// Screen 2 — First-time welcome (Variant C, "Navy banner")
// Pulls the volunteer's first name and the active client's name from the
// database. Returning users with a stamped completed_welcome_at skip ahead.

export default async function WelcomePage() {
  const session = await loadSession();
  if (!session) redirect("/login");

  const supabase = getSupabaseServiceRoleClient();
  const { data: profile } = await supabase
    .from("users")
    .select("completed_welcome_at, full_name")
    .eq("id", session.user.id)
    .maybeSingle();

  const completedAt =
    (profile as { completed_welcome_at: string | null } | null)?.completed_welcome_at ?? null;
  if (completedAt) {
    redirect("/v/time");
  }

  const fullName =
    (profile as { full_name: string | null } | null)?.full_name ?? session.user.full_name ?? "";
  const firstName = (fullName.split(/\s+/)[0] || "there").trim();

  const client = await getActiveClient();
  const clientName = client?.name ?? session.district?.name ?? "the campaign";
  // election_date isn't on the clients table yet — fall back to a calm
  // placeholder. When the column lands, swap to client.election_date.
  const electionDate = "election day";

  return (
    <WelcomeClient
      firstName={firstName}
      clientName={clientName}
      electionDate={electionDate}
      alreadyCompleted={false}
    />
  );
}
