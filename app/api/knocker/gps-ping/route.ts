import { NextResponse } from "next/server";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";

// POST /api/knocker/gps-ping
// Records a single GPS ping. The client beacons this every ~15s during an
// active knock session. Bodies with no session_id are accepted (e.g. ambient
// pings while the volunteer hasn't started yet) but those will be rare.

interface Ping {
  lat: number;
  lng: number;
  accuracy_meters?: number | null;
  recorded_at?: string;
  session_id?: string | null;
}

export async function POST(req: Request) {
  const session = await loadSession();
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { pings?: Ping[] } | Ping;
  const pings: Ping[] = Array.isArray((body as { pings?: Ping[] }).pings)
    ? (body as { pings: Ping[] }).pings
    : [body as Ping];

  const valid = pings.filter(
    (p) =>
      p &&
      typeof p.lat === "number" &&
      typeof p.lng === "number" &&
      Number.isFinite(p.lat) &&
      Number.isFinite(p.lng),
  );
  if (valid.length === 0) {
    return NextResponse.json({ error: "no valid pings" }, { status: 400 });
  }

  const rows = valid.map((p) => ({
    user_id: session.user.id,
    session_id: p.session_id ?? null,
    lat: p.lat,
    lng: p.lng,
    accuracy_meters: p.accuracy_meters ?? null,
    recorded_at: p.recorded_at ?? new Date().toISOString(),
  }));

  const supabase = getSupabaseServiceRoleClient();
  const { error } = await supabase.from("gps_pings").insert(rows);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, accepted: rows.length });
}
