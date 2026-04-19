import { requireOnboardedKnocker } from "@/lib/auth/onboarding";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Household, Walkbook } from "@/lib/types";
import { MapView } from "@/components/knocker/map-view";

export const dynamic = "force-dynamic";

export default async function MapPage() {
  const session = await requireOnboardedKnocker();
  if (!session.district) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-muted-foreground">
        No district assigned to your account. Ask your admin.
      </div>
    );
  }

  const supabase = getSupabaseServerClient();
  const [hhRes, wbRes] = await Promise.all([
    supabase
      .from("households")
      .select("*")
      .eq("district_id", session.district.id),
    supabase
      .from("walkbooks")
      .select("*")
      .eq("district_id", session.district.id),
  ]);
  if (hhRes.error) console.error("map: households query failed", hhRes.error);
  if (wbRes.error) console.error("map: walkbooks query failed", wbRes.error);
  const households = hhRes.data ?? [];
  const walkbooks = wbRes.data ?? [];

  return (
    <MapView
      userId={session.user.id}
      districtId={session.district.id}
      households={(households ?? []) as Household[]}
      walkbooks={(walkbooks ?? []) as Walkbook[]}
    />
  );
}
