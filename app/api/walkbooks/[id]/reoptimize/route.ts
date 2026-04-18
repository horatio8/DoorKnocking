import { NextResponse } from "next/server";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { optimize, type OptimizerStop } from "@/lib/walkbooks/optimizer";
import {
  DEFAULT_CALIBRATION,
  estimateMinutes,
  type EstimatorCalibration,
} from "@/lib/walkbooks/estimator";

// POST /api/walkbooks/[id]/reoptimize
// Re-orders the walkbook's un-knocked households from the provided `from`
// point (defaults to the walkbook centroid). Knocked households keep their
// current order_index and sit at the front of the list.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await loadSession();
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { lat?: number; lng?: number };
  const supabase = getSupabaseServiceRoleClient();

  const { data: wb } = await supabase
    .from("walkbooks")
    .select("id, district_id, optimized_route_version, centroid_lat, centroid_lng")
    .eq("id", params.id)
    .maybeSingle();
  if (!wb) return NextResponse.json({ error: "walkbook not found" }, { status: 404 });

  const { data: wbHH } = await supabase
    .from("walkbook_households")
    .select("household_id, order_index, households(id, lat, lng, neighborhood_id, address_line1)")
    .eq("walkbook_id", params.id);
  const rows = (wbHH ?? []) as Array<{
    household_id: string;
    order_index: number;
    households: { id: string; lat: number; lng: number; neighborhood_id: string | null; address_line1: string | null } | null;
  }>;

  const hhIds = rows.map((r) => r.household_id);
  const { data: knocks } = await supabase
    .from("knock_events")
    .select("household_id")
    .in("household_id", hhIds.length > 0 ? hhIds : [""]);
  const knocked = new Set(((knocks ?? []) as Array<{ household_id: string }>).map((k) => k.household_id));

  const knockedRows = rows.filter((r) => knocked.has(r.household_id));
  const remainingStops: (OptimizerStop & { id: string })[] = rows
    .filter((r) => !knocked.has(r.household_id) && r.households)
    .map((r) => ({
      id: r.households!.id,
      lat: Number(r.households!.lat),
      lng: Number(r.households!.lng),
    }));

  const start =
    typeof body.lat === "number" && typeof body.lng === "number"
      ? { lat: body.lat, lng: body.lng }
      : wb.centroid_lat != null && wb.centroid_lng != null
        ? { lat: Number(wb.centroid_lat), lng: Number(wb.centroid_lng) }
        : undefined;

  const { order, improvedFromSeed } = optimize(remainingStops, { start });

  // Rewrite order_index. Knocked rows keep their existing order_index
  // (stable, preserves history). Remaining rows get new indices starting
  // after the max knocked index.
  const maxKnockedIdx =
    knockedRows.length > 0 ? Math.max(...knockedRows.map((r) => r.order_index)) : -1;
  const updates = order.map((s, i) => ({ household_id: s.id, order_index: maxKnockedIdx + 1 + i }));
  if (updates.length > 0) {
    for (const u of updates) {
      await supabase
        .from("walkbook_households")
        .update({ order_index: u.order_index })
        .eq("walkbook_id", params.id)
        .eq("household_id", u.household_id);
    }
  }

  await supabase
    .from("walkbooks")
    .update({ optimized_route_version: (wb.optimized_route_version ?? 0) + 1 })
    .eq("id", params.id);

  // Return the new estimated minutes so the UI can refresh its header.
  const { data: cal } = await supabase
    .from("walk_time_calibration")
    .select("avg_contact_seconds, avg_apartment_seconds, avg_walking_speed_kmh")
    .eq("district_id", wb.district_id)
    .maybeSingle();
  const calibration: EstimatorCalibration = cal
    ? {
        avg_contact_seconds: Number(cal.avg_contact_seconds),
        avg_apartment_seconds: Number(cal.avg_apartment_seconds),
        avg_walking_speed_kmh: Number(cal.avg_walking_speed_kmh),
      }
    : DEFAULT_CALIBRATION;

  // Need full stops for estimate (estimator uses neighborhood/address).
  const fullOrder = order.map((s) => {
    const row = rows.find((r) => r.household_id === s.id)?.households;
    return {
      id: s.id,
      lat: s.lat,
      lng: s.lng,
      neighborhood_id: row?.neighborhood_id ?? null,
      address_line1: row?.address_line1 ?? null,
    };
  });
  const est = estimateMinutes(fullOrder, calibration);

  return NextResponse.json({
    remaining: order.length,
    estimatedMinutes: est.totalMinutes,
    metersSaved: Math.round(improvedFromSeed),
  });
}
