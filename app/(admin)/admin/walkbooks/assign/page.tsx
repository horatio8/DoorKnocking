import { redirect } from "next/navigation";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { getActiveClient } from "@/lib/clients/active";
import { AssignWalkbooksView } from "@/components/admin/assign-walkbooks";

export const dynamic = "force-dynamic";

export default async function AssignWalkbooksPage() {
  const session = await loadSession();
  if (!session) redirect("/login");
  if (session.user.role !== "admin" && session.user.role !== "super_admin") {
    redirect("/admin");
  }

  const supabase = getSupabaseServiceRoleClient();
  const activeClient = await getActiveClient();

  // Districts under active client. If no client in context, fall back to the
  // user's default district (admin on their own subdomain).
  const { data: districtRows } = activeClient
    ? await supabase
        .from("districts")
        .select("id, name, slug")
        .eq("client_id", activeClient.id)
        .order("name")
    : session.district?.id
      ? await supabase.from("districts").select("id, name, slug").eq("id", session.district.id)
      : { data: [] as Array<{ id: string; name: string; slug: string }> };
  const districts = (districtRows ?? []) as Array<{ id: string; name: string; slug: string }>;

  // Pick the first district as default target; UI has a switcher if >1.
  const activeDistrictId = districts[0]?.id ?? null;

  // Unassigned walkbooks (plus their stats).
  let walkbooks: Array<{
    id: string;
    name: string;
    district_id: string;
    household_count: number;
    estimated_duration_minutes: number | null;
    target_duration_minutes: number | null;
    status: string;
    kind: string;
    centroid_lat: number | null;
    centroid_lng: number | null;
  }> = [];
  let unassignedIds = new Set<string>();
  let activeAssignmentByWalkbook = new Map<string, { user_id: string }>();
  const stopsByWalkbook = new Map<string, Array<{ lat: number; lng: number }>>();
  if (districts.length > 0) {
    const districtIds = districts.map((d) => d.id);
    const { data: wbData } = await supabase
      .from("walkbooks")
      .select(
        "id, name, district_id, household_count, estimated_duration_minutes, target_duration_minutes, status, kind, centroid_lat, centroid_lng",
      )
      .in("district_id", districtIds)
      .neq("status", "complete")
      .eq("ephemeral", false)
      .order("estimated_duration_minutes", { ascending: false });
    walkbooks = (wbData ?? []) as typeof walkbooks;

    const wbIds = walkbooks.map((w) => w.id);
    if (wbIds.length > 0) {
      const { data: assigns } = await supabase
        .from("walkbook_assignments")
        .select("walkbook_id, user_id")
        .in("walkbook_id", wbIds)
        .is("unassigned_at", null);
      for (const a of (assigns ?? []) as Array<{ walkbook_id: string; user_id: string }>) {
        activeAssignmentByWalkbook.set(a.walkbook_id, { user_id: a.user_id });
      }

      // Ordered stops for the map overlay.
      const { data: stopRows } = await supabase
        .from("walkbook_households")
        .select("walkbook_id, order_index, household_id")
        .in("walkbook_id", wbIds)
        .order("order_index");
      const allHHIds = Array.from(
        new Set(
          ((stopRows ?? []) as Array<{ household_id: string }>).map((r) => r.household_id),
        ),
      );
      const coordById = new Map<string, { lat: number; lng: number }>();
      const CHUNK = 500;
      for (let i = 0; i < allHHIds.length; i += CHUNK) {
        const slice = allHHIds.slice(i, i + CHUNK);
        const { data } = await supabase
          .from("households")
          .select("id, lat, lng")
          .in("id", slice)
          .not("lat", "is", null)
          .not("lng", "is", null);
        for (const h of (data ?? []) as Array<{ id: string; lat: number; lng: number }>) {
          coordById.set(h.id, { lat: Number(h.lat), lng: Number(h.lng) });
        }
      }
      for (const r of (stopRows ?? []) as Array<{
        walkbook_id: string;
        household_id: string;
      }>) {
        const c = coordById.get(r.household_id);
        if (!c) continue;
        const list = stopsByWalkbook.get(r.walkbook_id) ?? [];
        list.push(c);
        stopsByWalkbook.set(r.walkbook_id, list);
      }
    }
    unassignedIds = new Set(walkbooks.filter((w) => !activeAssignmentByWalkbook.has(w.id)).map((w) => w.id));
  }

  // Volunteers (knockers) scoped to active client / districts. Plus active load.
  let volunteers: Array<{
    id: string;
    full_name: string | null;
    email: string;
    availability: string;
    total_time_budget_minutes: number;
    speed_rating: "slow" | "medium" | "fast";
    currentLoadMinutes: number;
    currentWalkbookCount: number;
    currentDoors: number;
  }> = [];
  if (districts.length > 0) {
    // Filter users by client_access containing active client (or super_admin).
    const clientFilterId = activeClient?.id ?? null;
    let q = supabase
      .from("users")
      .select("id, full_name, email, availability, total_time_budget_minutes, speed_rating, client_access")
      .eq("role", "knocker")
      .eq("active", true);
    const { data: knockers } = await q;
    const rows = (knockers ?? []) as Array<{
      id: string;
      full_name: string | null;
      email: string;
      availability: string;
      total_time_budget_minutes: number;
      speed_rating: "slow" | "medium" | "fast";
      client_access: string[] | null;
    }>;
    const scoped = clientFilterId
      ? rows.filter((u) => (u.client_access ?? []).includes(clientFilterId))
      : rows;

    // Active load per user.
    const userIds = scoped.map((u) => u.id);
    const loadByUser = new Map<string, { minutes: number; count: number; doors: number }>();
    if (userIds.length > 0) {
      const { data: activeAssigns } = await supabase
        .from("walkbook_assignments")
        .select(
          "user_id, walkbooks(id, status, household_count, estimated_duration_minutes, target_duration_minutes)",
        )
        .in("user_id", userIds)
        .is("unassigned_at", null);
      for (const a of (activeAssigns ?? []) as Array<{
        user_id: string;
        walkbooks:
          | {
              id: string;
              status: string;
              household_count: number;
              estimated_duration_minutes: number | null;
              target_duration_minutes: number | null;
            }
          | Array<{
              id: string;
              status: string;
              household_count: number;
              estimated_duration_minutes: number | null;
              target_duration_minutes: number | null;
            }>
          | null;
      }>) {
        const w = Array.isArray(a.walkbooks) ? a.walkbooks[0] : a.walkbooks;
        if (!w || w.status === "complete") continue;
        const entry = loadByUser.get(a.user_id) ?? { minutes: 0, count: 0, doors: 0 };
        entry.minutes += w.estimated_duration_minutes ?? w.target_duration_minutes ?? 0;
        entry.count += 1;
        entry.doors += w.household_count ?? 0;
        loadByUser.set(a.user_id, entry);
      }
    }

    volunteers = scoped.map((u) => ({
      id: u.id,
      full_name: u.full_name,
      email: u.email,
      availability: u.availability,
      total_time_budget_minutes: u.total_time_budget_minutes,
      speed_rating: u.speed_rating,
      currentLoadMinutes: loadByUser.get(u.id)?.minutes ?? 0,
      currentWalkbookCount: loadByUser.get(u.id)?.count ?? 0,
      currentDoors: loadByUser.get(u.id)?.doors ?? 0,
    }));
  }

  const stopsPayload: Record<string, Array<{ lat: number; lng: number }>> =
    Object.fromEntries(stopsByWalkbook.entries());

  return (
    <AssignWalkbooksView
      userId={session.user.id}
      districts={districts}
      initialDistrictId={activeDistrictId}
      walkbooks={walkbooks}
      stopsByWalkbook={stopsPayload}
      unassignedWalkbookIds={Array.from(unassignedIds)}
      activeAssignmentByWalkbook={Object.fromEntries(activeAssignmentByWalkbook.entries())}
      volunteers={volunteers}
    />
  );
}
