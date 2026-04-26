import { redirect } from "next/navigation";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { TimeClient } from "./time-client";

export const dynamic = "force-dynamic";

// Screen 3 — Time chip selector (Variant B, "Door estimates")
// Reads users.next_session_minutes so a returning volunteer sees their
// previous answer pre-selected. Tapping a chip writes the new value via
// /api/knocker/profile.

export default async function TimePage() {
  const session = await loadSession();
  if (!session) redirect("/login");

  const supabase = getSupabaseServiceRoleClient();
  const { data: profile } = await supabase
    .from("users")
    .select("next_session_minutes")
    .eq("id", session.user.id)
    .maybeSingle();

  const initial =
    (profile as { next_session_minutes: number | null } | null)?.next_session_minutes ?? null;

  return <TimeClient initialMinutes={initial} />;
}
