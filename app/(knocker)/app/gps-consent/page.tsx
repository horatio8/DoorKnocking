import { redirect } from "next/navigation";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { GpsConsentForm } from "@/components/knocker/gps-consent-form";

export const dynamic = "force-dynamic";

export default async function GpsConsentPage() {
  const session = await loadSession();
  if (!session) redirect("/login");

  const supabase = getSupabaseServiceRoleClient();
  const { data: profile } = await supabase
    .from("users")
    .select("gps_consent, is_paid_canvasser, completed_welcome_at")
    .eq("id", session.user.id)
    .maybeSingle();

  const row = (profile as {
    gps_consent: boolean | null;
    is_paid_canvasser: boolean | null;
    completed_welcome_at: string | null;
  } | null) ?? null;

  if (!row?.completed_welcome_at) {
    redirect("/app/welcome");
  }
  if (row.gps_consent) {
    redirect("/app/walkbooks/browse");
  }

  return <GpsConsentForm paidCanvasser={Boolean(row.is_paid_canvasser)} />;
}
