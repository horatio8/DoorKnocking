import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";

export interface MapHousehold {
  id: string;
  addressLine1: string;
  city: string | null;
  state: string | null;
  lat: number;
  lng: number;
  orderIndex: number;
  status: "not_knocked" | "no_answer" | "come_back_later" | "refused" | "contacted" | "mixed";
}

export interface MapBundle {
  walkbookId: string;
  walkbookName: string;
  households: MapHousehold[];
  knockedHouseholdIds: string[];
  contactCount: number;
  knockSession: {
    id: string;
    startedAt: string;
    plannedMinutes: number | null;
  } | null;
}

// Loads everything the map screen needs in one round-trip-equivalent: the
// walkbook stops in order, household status, the volunteer's open
// knock_session, and the count of "contacted" knocks for that session.
export async function loadMapBundle({
  userId,
  walkbookId,
  plannedMinutes,
}: {
  userId: string;
  walkbookId: string;
  plannedMinutes: number | null;
}): Promise<MapBundle | null> {
  const supabase = getSupabaseServiceRoleClient();

  const { data: wb } = await supabase
    .from("walkbooks")
    .select("id, name")
    .eq("id", walkbookId)
    .maybeSingle();
  if (!wb) return null;
  const wbRow = wb as { id: string; name: string };

  const { data: stops } = await supabase
    .from("walkbook_households")
    .select("household_id, order_index")
    .eq("walkbook_id", walkbookId)
    .order("order_index", { ascending: true });
  const stopRows = (stops ?? []) as Array<{ household_id: string; order_index: number }>;
  if (stopRows.length === 0) {
    return {
      walkbookId: wbRow.id,
      walkbookName: wbRow.name,
      households: [],
      knockedHouseholdIds: [],
      contactCount: 0,
      knockSession: null,
    };
  }

  const householdIds = stopRows.map((r) => r.household_id);
  const { data: hhs } = await supabase
    .from("households")
    .select("id, address_line1, city, state, lat, lng, current_status")
    .in("id", householdIds);
  const orderById = new Map(stopRows.map((r) => [r.household_id, r.order_index]));
  const households: MapHousehold[] = (hhs ?? [])
    .map((h) => {
      const row = h as {
        id: string;
        address_line1: string;
        city: string | null;
        state: string | null;
        lat: number | string;
        lng: number | string;
        current_status: MapHousehold["status"] | null;
      };
      return {
        id: row.id,
        addressLine1: row.address_line1,
        city: row.city,
        state: row.state,
        lat: Number(row.lat),
        lng: Number(row.lng),
        orderIndex: orderById.get(row.id) ?? 0,
        status: row.current_status ?? "not_knocked",
      };
    })
    .sort((a, b) => a.orderIndex - b.orderIndex);

  const { data: openSession } = await supabase
    .from("knock_sessions")
    .select("id, started_at, walkbook_id")
    .eq("user_id", userId)
    .is("ended_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sessionRow = openSession as
    | { id: string; started_at: string; walkbook_id: string | null }
    | null;

  // Count knocks already logged in this session for the walkbook so the top
  // bar can show "X of Y · Z contacts".
  let knockedHouseholdIds: string[] = [];
  let contactCount = 0;
  if (sessionRow) {
    const { data: events } = await supabase
      .from("knock_events")
      .select("household_id, status")
      .eq("user_id", userId)
      .eq("walkbook_id", walkbookId)
      .gte("knocked_at", sessionRow.started_at);
    const evs = (events ?? []) as Array<{ household_id: string; status: string }>;
    const seen = new Set<string>();
    for (const e of evs) {
      if (!seen.has(e.household_id)) {
        seen.add(e.household_id);
      }
      if (e.status === "contacted") contactCount += 1;
    }
    knockedHouseholdIds = Array.from(seen);
  }

  return {
    walkbookId: wbRow.id,
    walkbookName: wbRow.name,
    households,
    knockedHouseholdIds,
    contactCount,
    knockSession: sessionRow
      ? {
          id: sessionRow.id,
          startedAt: sessionRow.started_at,
          plannedMinutes,
        }
      : null,
  };
}
