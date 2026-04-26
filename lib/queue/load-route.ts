// Read-side counterpart to lib/queue/generate.ts. Fetches an ephemeral
// walkbook + its routed voters (joined to households) so the volunteer
// pages can render "Your route" without re-running scoring.

import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";

export interface RouteVoter {
  voterId: string;
  householdId: string;
  routeOrder: number;
  scoreAtGeneration: number;
  isBacklog: boolean;
  displayName: string;
  party: string | null;
  lat: number;
  lng: number;
  addressLine1: string;
  city: string | null;
  state: string | null;
  householdStatus:
    | "not_knocked"
    | "no_answer"
    | "come_back_later"
    | "refused"
    | "contacted"
    | "mixed";
}

export interface RouteBundle {
  walkbookId: string;
  walkbookName: string;
  generatedAt: string;
  expiresAt: string | null;
  status: string;
  targetMinutes: number;
  voterCount: number;
  voters: RouteVoter[];
}

export async function loadRoute(walkbookId: string): Promise<RouteBundle | null> {
  const supabase = getSupabaseServiceRoleClient();

  const { data: wb } = await supabase
    .from("walkbooks")
    .select(
      "id, name, status, expires_at, created_at, target_duration_minutes, voters_planned, ephemeral",
    )
    .eq("id", walkbookId)
    .maybeSingle();
  if (!wb) return null;
  const wbRow = wb as {
    id: string;
    name: string;
    status: string;
    expires_at: string | null;
    created_at: string;
    target_duration_minutes: number | null;
    voters_planned: number | null;
    ephemeral: boolean;
  };

  const { data: rows } = await supabase
    .from("walkbook_voters")
    .select("voter_id, household_id, route_order, score_at_generation, is_backlog")
    .eq("walkbook_id", walkbookId)
    .order("route_order", { ascending: true });
  const voterRows = (rows ?? []) as Array<{
    voter_id: string;
    household_id: string;
    route_order: number;
    score_at_generation: number | string;
    is_backlog: boolean;
  }>;
  if (voterRows.length === 0) {
    return {
      walkbookId: wbRow.id,
      walkbookName: wbRow.name,
      generatedAt: wbRow.created_at,
      expiresAt: wbRow.expires_at,
      status: wbRow.status,
      targetMinutes: wbRow.target_duration_minutes ?? 0,
      voterCount: 0,
      voters: [],
    };
  }

  const voterIds = voterRows.map((r) => r.voter_id);
  const householdIds = Array.from(new Set(voterRows.map((r) => r.household_id)));

  const [votersRes, hhsRes] = await Promise.all([
    supabase
      .from("voters")
      .select("id, display_name, observed_party, calculated_party, official_party")
      .in("id", voterIds),
    supabase
      .from("households")
      .select("id, address_line1, city, state, lat, lng, current_status")
      .in("id", householdIds),
  ]);

  const voterById = new Map<
    string,
    {
      id: string;
      display_name: string | null;
      observed_party: string | null;
      calculated_party: string | null;
      official_party: string | null;
    }
  >();
  for (const v of (votersRes.data ?? []) as Array<{
    id: string;
    display_name: string | null;
    observed_party: string | null;
    calculated_party: string | null;
    official_party: string | null;
  }>) {
    voterById.set(v.id, v);
  }

  const hhById = new Map<
    string,
    {
      id: string;
      address_line1: string;
      city: string | null;
      state: string | null;
      lat: number | string;
      lng: number | string;
      current_status: RouteVoter["householdStatus"] | null;
    }
  >();
  for (const h of (hhsRes.data ?? []) as Array<{
    id: string;
    address_line1: string;
    city: string | null;
    state: string | null;
    lat: number | string;
    lng: number | string;
    current_status: RouteVoter["householdStatus"] | null;
  }>) {
    hhById.set(h.id, h);
  }

  const voters: RouteVoter[] = voterRows
    .map((r) => {
      const v = voterById.get(r.voter_id);
      const h = hhById.get(r.household_id);
      if (!v || !h) return null;
      return {
        voterId: r.voter_id,
        householdId: r.household_id,
        routeOrder: r.route_order,
        scoreAtGeneration: Number(r.score_at_generation),
        isBacklog: r.is_backlog,
        displayName: v.display_name?.trim() || "Unnamed voter",
        party: v.observed_party ?? v.calculated_party ?? v.official_party ?? null,
        lat: Number(h.lat),
        lng: Number(h.lng),
        addressLine1: h.address_line1,
        city: h.city,
        state: h.state,
        householdStatus: h.current_status ?? "not_knocked",
      } as RouteVoter;
    })
    .filter((x): x is RouteVoter => x !== null);

  return {
    walkbookId: wbRow.id,
    walkbookName: wbRow.name,
    generatedAt: wbRow.created_at,
    expiresAt: wbRow.expires_at,
    status: wbRow.status,
    targetMinutes: wbRow.target_duration_minutes ?? 0,
    voterCount: voters.filter((v) => !v.isBacklog).length,
    voters,
  };
}

// Convenience: grab the volunteer's most recent open ephemeral walkbook.
// Used by the map page when no ?wb= query param is present.
export async function loadCurrentRouteForUser(userId: string): Promise<RouteBundle | null> {
  const supabase = getSupabaseServiceRoleClient();
  const { data } = await supabase
    .from("walkbooks")
    .select("id")
    .eq("knocker_id", userId)
    .eq("ephemeral", true)
    .neq("status", "complete")
    .neq("status", "abandoned")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const id = (data as { id?: string } | null)?.id;
  if (!id) return null;
  return loadRoute(id);
}
