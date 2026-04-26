import { NextResponse } from "next/server";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { getActiveClient } from "@/lib/clients/active";
import { generateWalkbook } from "@/lib/queue/generate";

// POST /api/queue/generate
//
// Generates an ephemeral walkbook from the voter queue for the signed-in
// volunteer. Body shape:
//   {
//     target_minutes: 30 | 60 | 120 | 180 | 480,
//     gps?: { lat, lng } | null,
//     pace_multiplier?: number,
//     travel_mode?: 'walking' | 'driving',
//     replace_existing?: boolean   // close any open ephemeral walkbook first
//   }
// Returns { walkbook_id, voter_count, estimated_minutes }.

export const dynamic = "force-dynamic";

interface Body {
  target_minutes?: number;
  gps?: { lat: number; lng: number } | null;
  pace_multiplier?: number;
  travel_mode?: "walking" | "driving";
  replace_existing?: boolean;
}

export async function POST(req: Request) {
  const session = await loadSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Body;
  const target = body.target_minutes;
  if (target !== 30 && target !== 60 && target !== 120 && target !== 180 && target !== 480) {
    return NextResponse.json(
      { error: "target_minutes must be one of 30, 60, 120, 180, 480" },
      { status: 400 },
    );
  }

  const districtId = session.district?.id ?? session.user.default_district_id ?? null;
  if (!districtId) {
    return NextResponse.json(
      { error: "no district assigned to your account" },
      { status: 400 },
    );
  }

  const supabase = getSupabaseServiceRoleClient();

  if (body.replace_existing) {
    await supabase
      .from("walkbooks")
      .update({ status: "abandoned" })
      .eq("knocker_id", session.user.id)
      .eq("ephemeral", true)
      .eq("status", "open");
  }

  const client = await getActiveClient();
  // Best-effort target party from the client. We don't yet store it on the
  // clients table — until then we leave it null and the priority signal
  // collapses to a non-partisan default per scoreVoters().
  const targetParty: string | null = null;
  void client;

  try {
    const result = await generateWalkbook(supabase, {
      knockerId: session.user.id,
      districtId,
      targetMinutes: target,
      paceMultiplier: body.pace_multiplier ?? 1.0,
      travelMode: body.travel_mode ?? "walking",
      gps: body.gps ?? null,
      targetParty,
    });

    return NextResponse.json({
      walkbook_id: result.walkbookId,
      voter_count: result.voterCount,
      estimated_minutes: result.estimatedMinutes,
      starting: result.startingLatLng,
    });
  } catch (err) {
    console.error("[queue/generate] failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "generation failed" },
      { status: 500 },
    );
  }
}
