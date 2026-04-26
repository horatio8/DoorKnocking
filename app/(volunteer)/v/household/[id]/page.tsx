import { notFound, redirect } from "next/navigation";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { loadVolunteerHousehold } from "@/lib/volunteer/load-household";
import { HouseholdClient } from "./household-client";

export const dynamic = "force-dynamic";

// Screen 7 — Household detail.

export default async function HouseholdPage({ params }: { params: { id: string } }) {
  const session = await loadSession();
  if (!session) redirect("/login");

  const household = await loadVolunteerHousehold(params.id);
  if (!household) notFound();

  // Pull the open knock_session for walkbook context (so logged events can
  // be attributed to the right walkbook for stats).
  const supabase = getSupabaseServiceRoleClient();
  const { data: open } = await supabase
    .from("knock_sessions")
    .select("id, walkbook_id")
    .eq("user_id", session.user.id)
    .is("ended_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const openRow = open as { id: string; walkbook_id: string | null } | null;

  return (
    <HouseholdClient
      household={household}
      walkbookId={openRow?.walkbook_id ?? null}
      knockSessionId={openRow?.id ?? null}
    />
  );
}
