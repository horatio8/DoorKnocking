import { NextResponse } from "next/server";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import {
  DEFAULT_CALIBRATION,
  type EstimatorCalibration,
} from "@/lib/walkbooks/estimator";
import { generateDynamicWalkbook, type DynamicCandidate } from "@/lib/walkbooks/dynamic";

export const maxDuration = 30;

interface Body {
  districtId?: string;
  lat: number;
  lng: number;
  budgetMinutes?: number;
  avoidCompleted?: boolean;
  priorityOnly?: boolean;
}

// POST /api/walkbooks/dynamic
// Generates an ephemeral "walk from here" walkbook for the current knocker.
// Returns the new walkbook id; knocker can start it or preview it.
export async function POST(req: Request) {
  const session = await loadSession();
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as Body;
  const districtId = body.districtId ?? session.district?.id;
  if (!districtId) return NextResponse.json({ error: "districtId required" }, { status: 400 });
  if (typeof body.lat !== "number" || typeof body.lng !== "number") {
    return NextResponse.json({ error: "lat and lng required" }, { status: 400 });
  }

  const started = Date.now();
  const supabase = getSupabaseServiceRoleClient();

  const { data: calRow } = await supabase
    .from("walk_time_calibration")
    .select("avg_contact_seconds, avg_apartment_seconds, avg_walking_speed_kmh")
    .eq("district_id", districtId)
    .maybeSingle();
  const calibration: EstimatorCalibration = calRow
    ? {
        avg_contact_seconds: Number(calRow.avg_contact_seconds),
        avg_apartment_seconds: Number(calRow.avg_apartment_seconds),
        avg_walking_speed_kmh: Number(calRow.avg_walking_speed_kmh),
      }
    : DEFAULT_CALIBRATION;

  const { data: households, error } = await supabase
    .from("households")
    .select("id, lat, lng, neighborhood_id, address_line1")
    .eq("district_id", districtId)
    .not("lat", "is", null)
    .not("lng", "is", null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!households || households.length === 0) {
    return NextResponse.json({ error: "no households available" }, { status: 400 });
  }

  let filtered = households;
  if (body.avoidCompleted) {
    const allIds = households.map((h) => h.id as string);
    const knockedIds = new Set<string>();
    const CHUNK = 500;
    for (let i = 0; i < allIds.length; i += CHUNK) {
      const slice = allIds.slice(i, i + CHUNK);
      const { data: knocks } = await supabase
        .from("knock_events")
        .select("household_id")
        .in("household_id", slice);
      for (const k of (knocks ?? []) as Array<{ household_id: string }>) knockedIds.add(k.household_id);
    }
    filtered = households.filter((h) => !knockedIds.has(h.id as string));
    if (filtered.length === 0) {
      return NextResponse.json({ error: "every household in this district is already contacted" }, { status: 400 });
    }
  }

  const ids = filtered.map((h) => h.id as string);
  const voterCounts = new Map<string, number>();
  {
    const chunk = 500;
    for (let i = 0; i < ids.length; i += chunk) {
      const slice = ids.slice(i, i + chunk);
      const { data: voters } = await supabase
        .from("voters")
        .select("household_id")
        .in("household_id", slice);
      for (const v of (voters ?? []) as Array<{ household_id: string }>) {
        voterCounts.set(v.household_id, (voterCounts.get(v.household_id) ?? 0) + 1);
      }
    }
  }

  const candidates: DynamicCandidate[] = filtered.map((h) => ({
    id: h.id as string,
    lat: Number(h.lat),
    lng: Number(h.lng),
    neighborhood_id: (h.neighborhood_id as string | null) ?? null,
    address_line1: (h.address_line1 as string | null) ?? null,
    voter_count: voterCounts.get(h.id as string) ?? 1,
  }));

  const result = generateDynamicWalkbook(candidates, {
    start: { lat: body.lat, lng: body.lng },
    budgetMinutes: body.budgetMinutes ?? 60,
    calibration,
  });

  if (result.orderedStops.length === 0) {
    return NextResponse.json({ error: "no reachable doors within budget from current location" }, { status: 400 });
  }

  // Compute centroid + bounding box from picked stops.
  const stops = result.orderedStops;
  const lat = stops.map((s) => s.lat);
  const lng = stops.map((s) => s.lng);
  const centroidLat = lat.reduce((a, b) => a + b, 0) / lat.length;
  const centroidLng = lng.reduce((a, b) => a + b, 0) / lng.length;
  const boundingBox = {
    north: Math.max(...lat),
    south: Math.min(...lat),
    east: Math.max(...lng),
    west: Math.min(...lng),
  };

  const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
  const { data: wb, error: insertErr } = await supabase
    .from("walkbooks")
    .insert({
      district_id: districtId,
      name: `Dynamic — ${new Date().toISOString().slice(11, 16)}`,
      description: `${stops.length} doors · ~${result.estimatedMinutes}m`,
      household_count: stops.length,
      centroid_lat: centroidLat,
      centroid_lng: centroidLng,
      bounding_box: boundingBox,
      estimated_duration_minutes: result.estimatedMinutes,
      target_duration_minutes: body.budgetMinutes ?? 60,
      kind: "dynamic",
      ephemeral: true,
      expires_at: expiresAt,
      optimized_route_version: 1,
      auto_generated: true,
      status: "open",
      created_by: session.user.id,
    })
    .select("id")
    .single();
  if (insertErr || !wb) return NextResponse.json({ error: insertErr?.message ?? "insert failed" }, { status: 500 });

  const joins = stops.map((s, i) => ({
    walkbook_id: wb.id,
    household_id: s.id,
    order_index: i,
  }));
  await supabase.from("walkbook_households").insert(joins);

  await supabase.from("walkbook_generation_runs").insert({
    district_id: districtId,
    run_by: session.user.id,
    kind: "dynamic",
    input_params: {
      lat: body.lat,
      lng: body.lng,
      budgetMinutes: body.budgetMinutes ?? 60,
      avoidCompleted: Boolean(body.avoidCompleted),
      priorityOnly: Boolean(body.priorityOnly),
    },
    walkbook_ids: [wb.id],
    household_count: stops.length,
    duration_ms: Date.now() - started,
  });

  return NextResponse.json({
    walkbookId: wb.id,
    households: stops.length,
    estimatedMinutes: result.estimatedMinutes,
    expiresAt,
  });
}
