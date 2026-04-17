import { NextResponse } from "next/server";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { clusterHouseholds } from "@/lib/geo/clustering";

export async function POST(request: Request) {
  const session = await loadSession();
  if (!session || (session.user.role !== "admin" && session.user.role !== "super_admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const districtId = String(body.districtId ?? "");
  const targetSize = Number(body.targetSize ?? 20);
  if (!districtId) return NextResponse.json({ error: "districtId required" }, { status: 400 });

  const supabase = getSupabaseServiceRoleClient();
  const { data: district, error: dErr } = await supabase
    .from("districts")
    .select("name, default_walkbook_size")
    .eq("id", districtId)
    .maybeSingle();
  if (dErr || !district) return NextResponse.json({ error: "district not found" }, { status: 404 });

  const { data: households, error: hErr } = await supabase
    .from("households")
    .select("id, lat, lng, neighborhood_id, address_line1")
    .eq("district_id", districtId);
  if (hErr) return NextResponse.json({ error: hErr.message }, { status: 500 });
  if (!households || households.length === 0) {
    return NextResponse.json({ error: "no households" }, { status: 400 });
  }

  const clusters = clusterHouseholds(
    households.map((h: { id: string; lat: number; lng: number }) => ({
      id: h.id,
      lat: Number(h.lat),
      lng: Number(h.lng),
    })),
    targetSize || district.default_walkbook_size || 20,
  );

  // Delete any previously auto-generated walkbooks so reruns stay idempotent.
  await supabase.from("walkbooks").delete().eq("district_id", districtId).eq("auto_generated", true);

  let created = 0;
  for (const cluster of clusters) {
    const number = String(cluster.index + 1).padStart(2, "0");
    const { data: wb, error: insertErr } = await supabase
      .from("walkbooks")
      .insert({
        district_id: districtId,
        name: `${district.name} — Cluster ${number}`,
        description: `${cluster.points.length} households · ~${cluster.estimatedDurationMinutes}m`,
        household_count: cluster.points.length,
        centroid_lat: cluster.centroid.lat,
        centroid_lng: cluster.centroid.lng,
        bounding_box: cluster.boundingBox,
        estimated_duration_minutes: cluster.estimatedDurationMinutes,
        auto_generated: true,
        status: "open",
        created_by: session.user.id,
      })
      .select()
      .maybeSingle();
    if (insertErr || !wb) continue;
    const joins = cluster.points.map((p, idx) => ({
      walkbook_id: wb.id,
      household_id: p.id,
      order_index: idx,
    }));
    if (joins.length > 0) await supabase.from("walkbook_households").insert(joins);
    created++;
  }

  return NextResponse.json({ created, clusters: clusters.length });
}
