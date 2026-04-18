import { NextResponse } from "next/server";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";

// GET /api/walkbooks/[id]/route-polyline
// Returns an ordered list of stops + (if available) a Mapbox walking
// Directions polyline between them. Falls back to straight-line if no
// Mapbox secret token or the Directions API errors.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await loadSession();
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const supabase = getSupabaseServiceRoleClient();
  const { data: rows, error } = await supabase
    .from("walkbook_households")
    .select("order_index, household_id, households(id, lat, lng, address_line1, city)")
    .eq("walkbook_id", params.id)
    .order("order_index");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  type H = { id: string; lat: number; lng: number; address_line1: string | null; city: string | null };
  type JoinRow = { order_index: number; household_id: string; households: H | H[] | null };
  const stops = ((rows ?? []) as unknown as JoinRow[])
    .map((r) => (Array.isArray(r.households) ? r.households[0] ?? null : r.households))
    .filter((h): h is H => !!h)
    .map((h) => ({
      id: h.id,
      lat: Number(h.lat),
      lng: Number(h.lng),
      address: [h.address_line1, h.city].filter(Boolean).join(", "),
    }));

  if (stops.length < 2) return NextResponse.json({ stops, polyline: null });

  const token = process.env.MAPBOX_SECRET_TOKEN ?? process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) return NextResponse.json({ stops, polyline: null, reason: "no_mapbox_token" });

  // Mapbox walking directions caps at 25 waypoints per call.
  const chunks: Array<typeof stops> = [];
  const LIMIT = 25;
  for (let i = 0; i < stops.length; i += LIMIT - 1) {
    chunks.push(stops.slice(i, Math.min(stops.length, i + LIMIT)));
  }
  const geometry: Array<[number, number]> = [];
  try {
    for (const chunk of chunks) {
      const coords = chunk.map((s) => `${s.lng},${s.lat}`).join(";");
      const url = `https://api.mapbox.com/directions/v5/mapbox/walking/${coords}?geometries=geojson&overview=full&access_token=${token}`;
      const res = await fetch(url);
      if (!res.ok) {
        return NextResponse.json({ stops, polyline: null, reason: `mapbox_${res.status}` });
      }
      const body = (await res.json()) as {
        routes?: Array<{ geometry: { coordinates: Array<[number, number]> } }>;
      };
      const coordsOut = body.routes?.[0]?.geometry?.coordinates ?? [];
      if (geometry.length === 0) geometry.push(...coordsOut);
      else geometry.push(...coordsOut.slice(1));
    }
  } catch (err) {
    return NextResponse.json({ stops, polyline: null, reason: (err as Error).message });
  }

  return NextResponse.json({ stops, polyline: geometry });
}
