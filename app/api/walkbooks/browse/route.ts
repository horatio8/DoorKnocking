import { NextResponse } from "next/server";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { haversineMeters } from "@/lib/geo/distance";

// GET /api/walkbooks/browse?districtId=&budgetMinutes=&lat=&lng=&q=
//
// Returns the user's available walkbooks ranked by a composite score:
//   1. absolute gap between estimated_duration_minutes and budgetMinutes
//      (small gap = good fit) — primary sort
//   2. doors remaining (higher = better)
//   3. distance from reference point (closer = better)
// Filters out completed walkbooks and walkbooks the user can't access.

interface WalkbookRow {
  id: string;
  name: string;
  description: string | null;
  status: string;
  household_count: number;
  estimated_duration_minutes: number | null;
  target_duration_minutes: number | null;
  centroid_lat: number | null;
  centroid_lng: number | null;
  kind: string;
  district_id: string;
}

export async function GET(req: Request) {
  const session = await loadSession();
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const districtId = url.searchParams.get("districtId") ?? session.district?.id ?? null;
  if (!districtId) return NextResponse.json({ error: "districtId required" }, { status: 400 });

  const budget = Number(url.searchParams.get("budgetMinutes") ?? "90");
  const refLat = numOrNull(url.searchParams.get("lat"));
  const refLng = numOrNull(url.searchParams.get("lng"));
  const q = url.searchParams.get("q")?.trim().toLowerCase() ?? "";

  const supabase = getSupabaseServiceRoleClient();
  const { data: walkbooks, error } = await supabase
    .from("walkbooks")
    .select(
      "id, name, description, status, household_count, estimated_duration_minutes, target_duration_minutes, centroid_lat, centroid_lng, kind, district_id",
    )
    .eq("district_id", districtId)
    .neq("status", "completed")
    .eq("ephemeral", false);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const rows = (walkbooks ?? []) as WalkbookRow[];

  // Active assignments (for "in progress" badge).
  const ids = rows.map((r) => r.id);
  let activeByWalkbook = new Map<string, { user_id: string; full_name: string | null }>();
  if (ids.length > 0) {
    const { data: assigns } = await supabase
      .from("walkbook_assignments")
      .select("walkbook_id, user_id, users(full_name)")
      .in("walkbook_id", ids)
      .is("unassigned_at", null);
    activeByWalkbook = new Map(
      ((assigns ?? []) as Array<{
        walkbook_id: string;
        user_id: string;
        users: { full_name: string | null } | Array<{ full_name: string | null }> | null;
      }>).map((a) => {
        const u = Array.isArray(a.users) ? a.users[0] : a.users;
        return [a.walkbook_id, { user_id: a.user_id, full_name: u?.full_name ?? null }];
      }),
    );
  }

  // Doors knocked per walkbook — to compute doors remaining.
  let knockedByWalkbook = new Map<string, number>();
  if (ids.length > 0) {
    const { data: wbHH } = await supabase
      .from("walkbook_households")
      .select("walkbook_id, household_id")
      .in("walkbook_id", ids);
    const byWalkbook = new Map<string, string[]>();
    for (const r of (wbHH ?? []) as Array<{ walkbook_id: string; household_id: string }>) {
      (byWalkbook.get(r.walkbook_id) ?? byWalkbook.set(r.walkbook_id, []).get(r.walkbook_id)!).push(
        r.household_id,
      );
    }
    for (const [wbId, hhIds] of byWalkbook) {
      if (hhIds.length === 0) {
        knockedByWalkbook.set(wbId, 0);
        continue;
      }
      const { data: knocks } = await supabase
        .from("door_knocks")
        .select("household_id")
        .in("household_id", hhIds);
      const unique = new Set((knocks ?? []).map((k: { household_id: string }) => k.household_id));
      knockedByWalkbook.set(wbId, unique.size);
    }
  }

  const enriched = rows
    .filter((w) => {
      if (q && !w.name.toLowerCase().includes(q)) return false;
      return true;
    })
    .map((w) => {
      const est = w.estimated_duration_minutes ?? w.target_duration_minutes ?? 90;
      const gapMinutes = Math.abs(est - budget);
      const knocked = knockedByWalkbook.get(w.id) ?? 0;
      const doorsRemaining = Math.max(0, w.household_count - knocked);
      const active = activeByWalkbook.get(w.id) ?? null;
      const distanceMeters =
        refLat != null && refLng != null && w.centroid_lat != null && w.centroid_lng != null
          ? haversineMeters(
              { lat: refLat, lng: refLng },
              { lat: Number(w.centroid_lat), lng: Number(w.centroid_lng) },
            )
          : null;
      const efficiency = est > 0 ? doorsRemaining / est : 0;
      const completion = w.household_count > 0 ? knocked / w.household_count : 0;
      return {
        id: w.id,
        name: w.name,
        description: w.description,
        kind: w.kind,
        estimatedMinutes: est,
        doorsRemaining,
        doorsTotal: w.household_count,
        completion,
        efficiency,
        distanceMeters,
        activeAssignee: active,
        gapMinutes,
      };
    });

  enriched.sort((a, b) => {
    if (a.gapMinutes !== b.gapMinutes) return a.gapMinutes - b.gapMinutes;
    if (a.doorsRemaining !== b.doorsRemaining) return b.doorsRemaining - a.doorsRemaining;
    const ad = a.distanceMeters ?? Infinity;
    const bd = b.distanceMeters ?? Infinity;
    return ad - bd;
  });

  return NextResponse.json({ walkbooks: enriched, budget });
}

function numOrNull(x: string | null): number | null {
  if (!x) return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}
