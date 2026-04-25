import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";

// Resolves the walkbook a volunteer should land on.
//
// Order of preference:
//   1. An active walkbook_assignment for this user (most recent).
//   2. The first open walkbook in their district (so volunteers without an
//      explicit assignment still see something useful).
//
// Returns null when nothing matches — the caller renders an empty state.

export interface VolunteerWalkbook {
  id: string;
  name: string;
  doors: number;
  durationMins: number | null;
  centroid: { lat: number; lng: number } | null;
  start: { line1: string; line2: string; lat: number | null; lng: number | null } | null;
}

export async function loadVolunteerWalkbook({
  userId,
  districtId,
}: {
  userId: string;
  districtId: string | null;
}): Promise<VolunteerWalkbook | null> {
  const supabase = getSupabaseServiceRoleClient();

  let walkbookId: string | null = null;

  const { data: assignment } = await supabase
    .from("walkbook_assignments")
    .select("walkbook_id")
    .eq("user_id", userId)
    .is("unassigned_at", null)
    .order("assigned_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if ((assignment as { walkbook_id?: string } | null)?.walkbook_id) {
    walkbookId = (assignment as { walkbook_id: string }).walkbook_id;
  }

  if (!walkbookId && districtId) {
    const { data: open } = await supabase
      .from("walkbooks")
      .select("id")
      .eq("district_id", districtId)
      .neq("status", "complete")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if ((open as { id?: string } | null)?.id) walkbookId = (open as { id: string }).id;
  }

  if (!walkbookId) return null;

  const { data: wb } = await supabase
    .from("walkbooks")
    .select(
      "id, name, household_count, estimated_duration_minutes, centroid_lat, centroid_lng",
    )
    .eq("id", walkbookId)
    .maybeSingle();
  if (!wb) return null;

  const wbRow = wb as {
    id: string;
    name: string;
    household_count: number | null;
    estimated_duration_minutes: number | null;
    centroid_lat: number | null;
    centroid_lng: number | null;
  };

  // Pick the lowest-order_index household as the starting door.
  const { data: firstStop } = await supabase
    .from("walkbook_households")
    .select("household_id, order_index")
    .eq("walkbook_id", walkbookId)
    .order("order_index", { ascending: true })
    .limit(1)
    .maybeSingle();

  let start: VolunteerWalkbook["start"] = null;
  const startHhId = (firstStop as { household_id?: string } | null)?.household_id;
  if (startHhId) {
    const { data: hh } = await supabase
      .from("households")
      .select("address_line1, city, state, lat, lng")
      .eq("id", startHhId)
      .maybeSingle();
    if (hh) {
      const row = hh as {
        address_line1: string | null;
        city: string | null;
        state: string | null;
        lat: number | null;
        lng: number | null;
      };
      start = {
        line1: row.address_line1 ?? "",
        line2: [row.city, row.state].filter(Boolean).join(", "),
        lat: row.lat != null ? Number(row.lat) : null,
        lng: row.lng != null ? Number(row.lng) : null,
      };
    }
  }

  return {
    id: wbRow.id,
    name: wbRow.name,
    doors: wbRow.household_count ?? 0,
    durationMins: wbRow.estimated_duration_minutes,
    centroid:
      wbRow.centroid_lat != null && wbRow.centroid_lng != null
        ? { lat: Number(wbRow.centroid_lat), lng: Number(wbRow.centroid_lng) }
        : null,
    start,
  };
}
