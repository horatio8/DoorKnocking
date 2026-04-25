import { redirect } from "next/navigation";
import { loadSession } from "@/lib/auth/session";
import { getActiveClient } from "@/lib/clients/active";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { BriefingClient } from "./briefing-client";

export const dynamic = "force-dynamic";

// Screen 5 — Pre-knock briefing (Variant B, "Script-on-paper")

export default async function BriefingPage({ params }: { params: { id: string } }) {
  const session = await loadSession();
  if (!session) redirect("/login");

  const supabase = getSupabaseServiceRoleClient();
  const { data: profile } = await supabase
    .from("users")
    .select("full_name")
    .eq("id", session.user.id)
    .maybeSingle();
  const fullName =
    (profile as { full_name: string | null } | null)?.full_name ?? session.user.full_name ?? "";
  const firstName = (fullName.split(/\s+/)[0] || "there").trim();

  const client = await getActiveClient();
  const campaignName =
    client?.brand?.short_name ??
    client?.name?.split(/\s+for\s+/i)[0] ??
    client?.name ??
    "the";

  return (
    <BriefingClient firstName={firstName} campaignName={campaignName} walkbookId={params.id} />
  );
}
