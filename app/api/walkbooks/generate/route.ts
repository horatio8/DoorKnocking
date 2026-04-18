import { NextResponse } from "next/server";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { generateWalkbooks, type GeneratorInput } from "@/lib/walkbooks/generator";
import { DEFAULT_CALIBRATION, type EstimatorCalibration } from "@/lib/walkbooks/estimator";

export const maxDuration = 60;

interface GenerateBody {
  districtId: string;
  targetDurationMinutes?: number;
  priorityOnly?: boolean;
  excludeContacted?: boolean;
  precinctId?: string | null;
  parties?: string[] | null;
}

export async function POST(request: Request) {
  const session = await loadSession();
  if (!session || (session.user.role !== "admin" && session.user.role !== "super_admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as GenerateBody;
  if (!body.districtId) return NextResponse.json({ error: "districtId required" }, { status: 400 });

  const started = Date.now();
  const supabase = getSupabaseServiceRoleClient();

  const { data: district } = await supabase
    .from("districts")
    .select("id, name, slug")
    .eq("id", body.districtId)
    .maybeSingle();
  if (!district) return NextResponse.json({ error: "district not found" }, { status: 404 });

  const { data: calRow } = await supabase
    .from("walk_time_calibration")
    .select("avg_contact_seconds, avg_apartment_seconds, avg_walking_speed_kmh")
    .eq("district_id", body.districtId)
    .maybeSingle();
  const calibration: EstimatorCalibration = calRow
    ? {
        avg_contact_seconds: Number(calRow.avg_contact_seconds),
        avg_apartment_seconds: Number(calRow.avg_apartment_seconds),
        avg_walking_speed_kmh: Number(calRow.avg_walking_speed_kmh),
      }
    : DEFAULT_CALIBRATION;

  // Seed a calibration row on the first generation for this district so the
  // phase W4 job has somewhere to write empirical values later.
  if (!calRow) {
    await supabase
      .from("walk_time_calibration")
      .upsert({ district_id: body.districtId }, { onConflict: "district_id" });
  }

  // Load households that pass the filter.
  let query = supabase
    .from("households")
    .select("id, lat, lng, neighborhood_id, address_line1")
    .eq("district_id", body.districtId)
    .not("lat", "is", null)
    .not("lng", "is", null);

  // Exclude households that are fully contacted (every voter knocked) if the
  // caller asked for that. Implementation deferred to voter-level in W1 —
  // here we just use any door_knocks row as the proxy. Tighten in W4.
  if (body.excludeContacted) {
    const { data: knocked } = await supabase
      .from("door_knocks")
      .select("household_id")
      .eq("district_id", body.districtId);
    const excluded = new Set(((knocked ?? []) as Array<{ household_id: string }>).map((k) => k.household_id));
    if (excluded.size > 0) query = query.not("id", "in", `(${Array.from(excluded).join(",")})`);
  }

  const { data: households, error: hErr } = await query;
  if (hErr) return NextResponse.json({ error: hErr.message }, { status: 500 });
  if (!households || households.length === 0) {
    return NextResponse.json({ error: "no households match the filter" }, { status: 400 });
  }

  // voter_count per household (for contact-time weighting).
  const ids = households.map((h) => h.id as string);
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

  const stops: GeneratorInput[] = households.map((h) => ({
    id: h.id as string,
    lat: Number(h.lat),
    lng: Number(h.lng),
    neighborhood_id: (h.neighborhood_id as string | null) ?? null,
    address_line1: (h.address_line1 as string | null) ?? null,
    voter_count: voterCounts.get(h.id as string) ?? 1,
  }));

  const targetDuration = body.targetDurationMinutes ?? 90;
  const planned = generateWalkbooks(stops, {
    targetDurationMinutes: targetDuration,
    calibration,
  });

  // Persist. Follows SPEC §3.3 partial rule: keep walkbooks with ≥20%
  // completion untouched, replace others. Completion is counted by distinct
  // households with any knock event.
  const { data: existing } = await supabase
    .from("walkbooks")
    .select("id, household_count, kind")
    .eq("district_id", body.districtId);

  const keepIds: string[] = [];
  const replaceIds: string[] = [];
  for (const w of (existing ?? []) as Array<{ id: string; household_count: number; kind: string }>) {
    if (w.kind === "custom") {
      keepIds.push(w.id);
      continue;
    }
    const { data: knocks } = await supabase
      .from("door_knocks")
      .select("household_id", { count: "exact" })
      .in(
        "household_id",
        (
          await supabase
            .from("walkbook_households")
            .select("household_id")
            .eq("walkbook_id", w.id)
        ).data?.map((r: { household_id: string }) => r.household_id) ?? [""],
      );
    const completionRate =
      w.household_count > 0 && knocks ? new Set(knocks.map((k: { household_id: string }) => k.household_id)).size / w.household_count : 0;
    if (completionRate >= 0.2) keepIds.push(w.id);
    else replaceIds.push(w.id);
  }
  if (replaceIds.length > 0) {
    await supabase.from("walkbook_households").delete().in("walkbook_id", replaceIds);
    await supabase.from("walkbooks").delete().in("id", replaceIds);
  }

  const createdIds: string[] = [];
  for (const plan of planned) {
    const number = String(plan.index + 1).padStart(2, "0");
    const { data: wb } = await supabase
      .from("walkbooks")
      .insert({
        district_id: body.districtId,
        name: `${district.slug.toUpperCase()} — ${number}`,
        description: `${plan.orderedStops.length} households · est ${plan.estimatedMinutes}m`,
        household_count: plan.orderedStops.length,
        centroid_lat: plan.centroid.lat,
        centroid_lng: plan.centroid.lng,
        bounding_box: plan.boundingBox,
        estimated_duration_minutes: plan.estimatedMinutes,
        target_duration_minutes: targetDuration,
        kind: "preset",
        optimized_route_version: 1,
        auto_generated: true,
        status: "open",
        created_by: session.user.id,
      })
      .select("id")
      .maybeSingle();
    if (!wb) continue;
    const joins = plan.orderedStops.map((s, i) => ({
      walkbook_id: wb.id,
      household_id: s.id,
      order_index: i,
    }));
    if (joins.length > 0) await supabase.from("walkbook_households").insert(joins);
    createdIds.push(wb.id);
  }

  const durationMs = Date.now() - started;

  await supabase.from("walkbook_generation_runs").insert({
    district_id: body.districtId,
    run_by: session.user.id,
    kind: "full_district",
    input_params: {
      targetDurationMinutes: targetDuration,
      priorityOnly: Boolean(body.priorityOnly),
      excludeContacted: Boolean(body.excludeContacted),
      precinctId: body.precinctId ?? null,
      parties: body.parties ?? null,
    },
    walkbook_ids: createdIds,
    household_count: stops.length,
    duration_ms: durationMs,
    notes: keepIds.length > 0 ? `${keepIds.length} existing walkbook(s) preserved (≥20% complete or custom)` : null,
  });

  return NextResponse.json({
    created: createdIds.length,
    preserved: keepIds.length,
    walkbooks: planned.map((p) => ({
      index: p.index,
      households: p.orderedStops.length,
      estimatedMinutes: p.estimatedMinutes,
      detail: p.estimateDetail,
    })),
    durationMs,
  });
}
