import { redirect } from "next/navigation";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { getActiveClient } from "@/lib/clients/active";
import { WelcomeCards } from "@/components/knocker/welcome-cards";

export const dynamic = "force-dynamic";

export default async function WelcomePage() {
  const session = await loadSession();
  if (!session) redirect("/login");

  const supabase = getSupabaseServiceRoleClient();
  const { data: profile } = await supabase
    .from("users")
    .select("completed_welcome_at, commitment_level, next_session_minutes, gps_consent")
    .eq("id", session.user.id)
    .maybeSingle();

  const client = await getActiveClient();
  const districtName = session.district?.name ?? "your district";
  const clientName = client?.name ?? session.district?.name ?? "the campaign";

  // If already completed, skip ahead.
  const completed = Boolean(
    (profile as { completed_welcome_at: string | null } | null)?.completed_welcome_at,
  );
  if (completed) {
    redirect("/app/walkbooks/browse");
  }

  return (
    <WelcomeCards
      clientName={clientName}
      districtName={districtName}
      adminPhone={client?.contact_email ?? null}
      initialCommitment={(profile as { commitment_level: string | null } | null)?.commitment_level ?? null}
      initialSessionMinutes={
        (profile as { next_session_minutes: number | null } | null)?.next_session_minutes ?? null
      }
      gpsConsent={Boolean((profile as { gps_consent: boolean } | null)?.gps_consent)}
    />
  );
}
