import { NextResponse } from "next/server";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";

// Scheduled maintenance: recalibrate walk-time per district, then purge
// ephemeral walkbooks that have expired without any knock activity.
//
// Vercel Cron triggers this daily via GET; auth header is
// `Authorization: Bearer ${process.env.CRON_SECRET}`. For manual runs,
// POST with header `x-cron-secret: ${APP_SECRET}` also works.
//
// See SPEC §1.3 calibration and §5.2 ephemeral purge.

export const maxDuration = 60;

interface CalibrationUpdate {
  district_id: string;
  avg_contact_seconds: number;
  sample_size: number;
}

function authorized(req: Request): boolean {
  const vercelCronSecret = process.env.CRON_SECRET;
  const appSecret = process.env.APP_SECRET;
  const bearer = req.headers.get("authorization");
  if (vercelCronSecret && bearer === `Bearer ${vercelCronSecret}`) return true;
  const x = req.headers.get("x-cron-secret");
  if (appSecret && x === appSecret) return true;
  return false;
}

async function run(): Promise<Record<string, unknown>> {

  const supabase = getSupabaseServiceRoleClient();
  const summary: Record<string, unknown> = { at: new Date().toISOString() };

  // 1. Calibration — per district, compute avg contact seconds from
  //    knock_events.duration_seconds. Weekly cadence after 100 samples.
  const { data: districts } = await supabase.from("districts").select("id");
  const calUpdates: CalibrationUpdate[] = [];
  for (const d of ((districts ?? []) as Array<{ id: string }>)) {
    // Join via walkbooks: knock_events.walkbook_id → walkbooks.district_id.
    const { data: wbIds } = await supabase
      .from("walkbooks")
      .select("id")
      .eq("district_id", d.id);
    const wbIdList = ((wbIds ?? []) as Array<{ id: string }>).map((w) => w.id);
    if (wbIdList.length === 0) continue;

    const { data: events } = await supabase
      .from("knock_events")
      .select("duration_seconds")
      .in("walkbook_id", wbIdList)
      .not("duration_seconds", "is", null);
    const durations = ((events ?? []) as Array<{ duration_seconds: number }>)
      .map((e) => Number(e.duration_seconds))
      .filter((s) => s > 10 && s < 3600); // sanity-filter outliers
    if (durations.length === 0) continue;

    const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
    await supabase
      .from("walk_time_calibration")
      .upsert(
        {
          district_id: d.id,
          avg_contact_seconds: Math.round(avg),
          sample_size: durations.length,
          last_calibrated_at: new Date().toISOString(),
        },
        { onConflict: "district_id" },
      );
    calUpdates.push({ district_id: d.id, avg_contact_seconds: Math.round(avg), sample_size: durations.length });
  }
  summary.calibrated = calUpdates;

  // 2. Ephemeral purge — drop dynamic walkbooks past expires_at that never
  //    recorded a knock. If any knocks exist, keep the walkbook but flip
  //    ephemeral=false so it sticks around as historical record.
  const now = new Date().toISOString();
  const { data: expired } = await supabase
    .from("walkbooks")
    .select("id")
    .eq("ephemeral", true)
    .lt("expires_at", now);
  const expiredIds = ((expired ?? []) as Array<{ id: string }>).map((w) => w.id);
  let purged = 0;
  let preserved = 0;
  for (const id of expiredIds) {
    const { data: evs } = await supabase
      .from("knock_events")
      .select("id")
      .eq("walkbook_id", id)
      .limit(1);
    if ((evs ?? []).length > 0) {
      await supabase.from("walkbooks").update({ ephemeral: false, expires_at: null }).eq("id", id);
      preserved++;
    } else {
      await supabase.from("walkbook_households").delete().eq("walkbook_id", id);
      await supabase.from("walkbooks").delete().eq("id", id);
      purged++;
    }
  }
  summary.expired_walkbooks = expiredIds.length;
  summary.purged = purged;
  summary.preserved_with_knocks = preserved;

  return summary;
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return NextResponse.json(await run());
}

export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return NextResponse.json(await run());
}
