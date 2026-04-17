// Supabase Edge Function: walkbook-generate
// Deno runtime. Consumes { districtId, targetSize } and produces walkbooks
// using the same clustering logic we ship in the Next.js API route. We keep a
// stand-alone Deno copy so it can run from a cron/webhook without touching the
// web app.

// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { DBSCAN } from "https://esm.sh/density-clustering@1.3.0";

interface Payload {
  districtId: string;
  targetSize?: number;
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  const { districtId, targetSize } = (await req.json()) as Payload;
  if (!districtId) return new Response("districtId required", { status: 400 });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: district } = await supabase
    .from("districts")
    .select("name, default_walkbook_size")
    .eq("id", districtId)
    .maybeSingle();
  if (!district) return new Response("district not found", { status: 404 });

  const { data: households } = await supabase
    .from("households")
    .select("id, lat, lng")
    .eq("district_id", districtId);
  if (!households || households.length === 0) {
    return new Response("no households", { status: 400 });
  }

  const size = targetSize ?? district.default_walkbook_size ?? 20;
  const coords = households.map((h: any) => [Number(h.lat), Number(h.lng)]);
  const dbscan = new DBSCAN();
  const clusters = dbscan.run(coords, 0.003, 3); // ~330m, min 3 points
  const assigned = new Set<number>();
  clusters.forEach((c: number[]) => c.forEach((i) => assigned.add(i)));
  // Catch outliers in their own tiny walkbooks
  for (let i = 0; i < coords.length; i++) {
    if (!assigned.has(i)) clusters.push([i]);
  }

  // Split any cluster larger than `size`
  const finalClusters: number[][] = [];
  for (const c of clusters) {
    if (c.length <= size) {
      finalClusters.push(c);
    } else {
      const chunks = Math.ceil(c.length / size);
      const per = Math.ceil(c.length / chunks);
      for (let i = 0; i < c.length; i += per) finalClusters.push(c.slice(i, i + per));
    }
  }

  await supabase.from("walkbooks").delete().eq("district_id", districtId).eq("auto_generated", true);

  let created = 0;
  finalClusters.sort(
    (a, b) => avg(b.map((i) => coords[i][0])) - avg(a.map((i) => coords[i][0])),
  );
  let index = 0;
  for (const cluster of finalClusters) {
    const pts = cluster.map((i) => ({ id: households[i].id, lat: coords[i][0], lng: coords[i][1] }));
    const centroid = {
      lat: avg(pts.map((p) => p.lat)),
      lng: avg(pts.map((p) => p.lng)),
    };
    const bbox = {
      north: Math.max(...pts.map((p) => p.lat)),
      south: Math.min(...pts.map((p) => p.lat)),
      east: Math.max(...pts.map((p) => p.lng)),
      west: Math.min(...pts.map((p) => p.lng)),
    };
    const number = String(++index).padStart(2, "0");
    const { data: wb } = await supabase
      .from("walkbooks")
      .insert({
        district_id: districtId,
        name: `${district.name} — Cluster ${number}`,
        household_count: pts.length,
        centroid_lat: centroid.lat,
        centroid_lng: centroid.lng,
        bounding_box: bbox,
        estimated_duration_minutes: Math.max(15, pts.length * 3),
        auto_generated: true,
        status: "open",
      })
      .select()
      .maybeSingle();
    if (!wb) continue;
    await supabase
      .from("walkbook_households")
      .insert(pts.map((p, i) => ({ walkbook_id: wb.id, household_id: p.id, order_index: i })));
    created++;
  }

  return Response.json({ created });
});

function avg(arr: number[]): number {
  return arr.reduce((s, n) => s + n, 0) / arr.length;
}
