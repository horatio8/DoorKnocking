import { requireOnboardedKnocker } from "@/lib/auth/onboarding";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
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

  const supabase = getSupabaseServiceRoleClient();
  const [hhRes, wbRes] = await Promise.all([
    supabase.from("households").select("*").eq("district_id", session.district.id),
    supabase
      .from("walkbooks")
      .select("*")
      .eq("district_id", session.district.id)
      .eq("ephemeral", false)
      .neq("status", "complete"),
  ]);
  if (hhRes.error) console.error("map: households query failed", hhRes.error);
  if (wbRes.error) console.error("map: walkbooks query failed", wbRes.error);
  const households = (hhRes.data ?? []) as Household[];
  const walkbooks = (wbRes.data ?? []) as Walkbook[];

  // Build per-walkbook ordered stop lists for the route-line overlay.
  // household_id rides along on each stop so the client can resolve a
  // walkbook's first stop to a household → /app/household/<id> when
  // the volunteer hits "Nearest unknocked".
  const stopsByWalkbook = new Map<
    string,
    Array<{ lat: number; lng: number; order_index: number; household_id: string }>
  >();
  if (walkbooks.length > 0) {
    const wbIds = walkbooks.map((w) => w.id);
    const { data: stopRows } = await supabase
      .from("walkbook_households")
      .select("walkbook_id, household_id, order_index")
      .in("walkbook_id", wbIds)
      .order("order_index");
    const coordById = new Map<string, { lat: number; lng: number }>();
    for (const h of households) {
      if (h.lat != null && h.lng != null) {
        coordById.set(h.id, { lat: Number(h.lat), lng: Number(h.lng) });
      }
    }
    for (const r of (stopRows ?? []) as Array<{
      walkbook_id: string;
      household_id: string;
      order_index: number;
    }>) {
      const c = coordById.get(r.household_id);
      if (!c) continue;
      const list = stopsByWalkbook.get(r.walkbook_id) ?? [];
      list.push({
        lat: c.lat,
        lng: c.lng,
        order_index: r.order_index,
        household_id: r.household_id,
      });
      stopsByWalkbook.set(r.walkbook_id, list);
    }
  }
  const walkbookViz = walkbooks.map((w) => {
    const stops = stopsByWalkbook.get(w.id) ?? [];
    // Anchor the map pin at the walkbook's centroid if we have one; fall back
    // to the first stop so a pin always renders.
    const anchor = (() => {
      if (w.centroid_lat != null && w.centroid_lng != null) {
        return { lat: Number(w.centroid_lat), lng: Number(w.centroid_lng) };
      }
      if (stops.length > 0) return { lat: stops[0]!.lat, lng: stops[0]!.lng };
      return null;
    })();
    return {
      id: w.id,
      name: w.name,
      stops,
      anchor,
      household_count: w.household_count,
      estimated_duration_minutes: w.estimated_duration_minutes ?? null,
      status: w.status,
    };
  });

  // Which walkbooks belong to this knocker (for the "My walkbooks only" toggle)
  // + which of those the knocker self-selected (so DELETE self-assign is enabled).
  const myWalkbookIds: string[] = [];
  const selfAssignedIds: string[] = [];
  if (walkbooks.length > 0) {
    const { data: mine } = await supabase
      .from("walkbook_assignments")
      .select("walkbook_id, assigned_by, user_id")
      .eq("user_id", session.user.id)
      .is("unassigned_at", null);
    for (const m of (mine ?? []) as Array<{
      walkbook_id: string;
      assigned_by: string | null;
      user_id: string;
    }>) {
      myWalkbookIds.push(m.walkbook_id);
      if (m.assigned_by === session.user.id) selfAssignedIds.push(m.walkbook_id);
    }
  }

  console.info(
    "[server/map] rendered for user",
    session.user.id,
    "district",
    session.district.id,
    "households",
    households.length,
    "walkbooks",
    walkbooks.length,
  );

  return (
    <MapView
      userId={session.user.id}
      districtId={session.district.id}
      households={households}
      walkbooks={walkbooks}
      walkbookViz={walkbookViz}
      myWalkbookIds={myWalkbookIds}
      selfAssignedIds={selfAssignedIds}
    />
  );
}
