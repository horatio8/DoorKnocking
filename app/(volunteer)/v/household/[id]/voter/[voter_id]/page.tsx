import { notFound, redirect } from "next/navigation";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { OutcomeClient } from "./outcome-client";

export const dynamic = "force-dynamic";

// Screen 7a — Outcome (and Screen 7b come-back modal nested inside).

export default async function VoterOutcomePage({
  params,
}: {
  params: { id: string; voter_id: string };
}) {
  const session = await loadSession();
  if (!session) redirect("/login");

  const supabase = getSupabaseServiceRoleClient();
  const { data: voter } = await supabase
    .from("voters")
    .select("id, household_id, display_name")
    .eq("id", params.voter_id)
    .maybeSingle();
  const voterRow = voter as { id: string; household_id: string; display_name: string | null } | null;
  if (!voterRow || voterRow.household_id !== params.id) notFound();

  const { data: open } = await supabase
    .from("knock_sessions")
    .select("walkbook_id")
    .eq("user_id", session.user.id)
    .is("ended_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const walkbookId = (open as { walkbook_id: string | null } | null)?.walkbook_id ?? null;

  return (
    <OutcomeClient
      householdId={params.id}
      voterId={params.voter_id}
      voterName={voterRow.display_name?.trim() || "your voter"}
      walkbookId={walkbookId}
    />
  );
}
