import { NextResponse } from "next/server";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import {
  DEFAULT_CALIBRATION,
  type EstimatorCalibration,
} from "@/lib/walkbooks/estimator";
import { generateDynamicWalkbook, type DynamicCandidate } from "@/lib/walkbooks/dynamic";

export const maxDuration = 30;

// POST /api/walkbooks/[id]/continue
// Appends more stops onto an in-progress walkbook, starting from the
// knocker's current location and sized to the remaining time budget.
// Called when the knocker finishes their current route with time left.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await loadSession();
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as {
    lat: number;
    lng: number;
    budgetMinutes: number;
  };
  if (typeof body.lat !== "number" || typeof body.lng !== "number" || typeof body.budgetMinutes !== "number") {
    return NextResponse.json({ error: "lat, lng, budgetMinutes required" }, { status: 400 });
  }

  const supabase = getSupabaseServiceRoleClient();
  const { data: wb } = await supabase
    .from("walkbooks")
    .select("id, district_id, optimized_route_version")
    .eq("id", params.id)
    .maybeSingle();
  if (!wb) return NextResponse.json({ error: "walkbook not found" }, { status: 404 });

  const { data: calRow } = await supabase
    .from("walk_time_calibration")
    .select("avg_contact_seconds, avg_apartment_seconds, avg_walking_speed_kmh")
    .eq("district_id", wb.district_id)
    .maybeSingle();
  const calibration: EstimatorCalibration = calRow
    ? {
        avg_contact_seconds: Number(calRow.avg_contact_seconds),
        avg_apartment_seconds: Number(calRow.avg_apartment_seconds),
        avg_walking_speed_kmh: Number(calRow.avg_walking_speed_kmh),
      }
    : DEFAULT_CALIBRATION;

  // Already-on-the-walkbook houses — we skip these when picking new ones.
  const { data: existingRows } = await supabase
    .from("walkbook_households")
    .select("household_id, order_index")
    .eq("walkbook_id", params.id);
  const existingIds = new Set(
    ((existingRows ?? []) as Array<{ household_id: string }>).map((r) => r.household_id),
  );

  const { data: households } = await supabase
    .from("households")
    .select("id, lat, lng, neighborhood_id, address_line1")
    .eq("district_id", wb.district_id)
    .not("lat", "is", null)
    .not("lng", "is", null);
  const candidates: DynamicCandidate[] = ((households ?? []) as Array<{
    id: string;
    lat: number;
    lng: number;
    neighborhood_id: string | null;
    address_line1: string | null;
  }>)
    .filter((h) => !existingIds.has(h.id))
    .map((h) => ({
      id: h.id,
      lat: Number(h.lat),
      lng: Number(h.lng),
      neighborhood_id: h.neighborhood_id,
      address_line1: h.address_line1,
    }));

  const result = generateDynamicWalkbook(candidates, {
    start: { lat: body.lat, lng: body.lng },
    budgetMinutes: body.budgetMinutes,
    calibration,
  });

  if (result.orderedStops.length === 0) {
    return NextResponse.json({ added: 0, estimatedMinutes: 0 });
  }

  const nextOrderStart = Math.max(
    0,
    ...((existingRows ?? []) as Array<{ order_index: number }>).map((r) => r.order_index),
  ) + 1;
  const joins = result.orderedStops.map((s, i) => ({
    walkbook_id: params.id,
    household_id: s.id,
    order_index: nextOrderStart + i,
  }));
  await supabase.from("walkbook_households").insert(joins);

  await supabase
    .from("walkbooks")
    .update({
      household_count: (existingRows?.length ?? 0) + joins.length,
      optimized_route_version: (wb.optimized_route_version ?? 0) + 1,
    })
    .eq("id", params.id);

  return NextResponse.json({
    added: joins.length,
    estimatedMinutes: result.estimatedMinutes,
  });
}
