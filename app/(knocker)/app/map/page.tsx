import { redirect } from "next/navigation";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Household, Walkbook } from "@/lib/types";
import { MapView } from "@/components/knocker/map-view";

export const dynamic = "force-dynamic";

export default async function MapPage() {
  const session = await loadSession();
  if (!session) redirect("/login");
  if (!session.district) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-muted-foreground">
        No district assigned to your account. Ask your admin.
      </div>
    );
  }

  const supabase = getSupabaseServerClient();
  const [{ data: households }, { data: walkbooks }] = await Promise.all([
    supabase
      .from("households")
      .select("*")
      .eq("district_id", session.district.id),
    supabase
      .from("walkbooks")
      .select("*")
      .eq("district_id", session.district.id),
  ]);

  return (
    <MapView
      userId={session.user.id}
      districtId={session.district.id}
      households={(households ?? []) as Household[]}
      walkbooks={(walkbooks ?? []) as Walkbook[]}
    />
  );
}
