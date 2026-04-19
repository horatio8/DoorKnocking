import { NextResponse } from "next/server";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";

// PATCH /api/knocker/profile
// Self-service profile updates the knocker controls: welcome completion,
// commitment + session prefs, GPS and voice-note consents, pace, budget.

export async function PATCH(req: Request) {
  const session = await loadSession();
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as {
    completed_welcome?: boolean;
    commitment_level?: "one_time" | "few_sessions" | "regular" | "unknown" | null;
    next_session_minutes?: number | null;
    gps_consent?: boolean;
    gps_consent_version?: string;
    voice_note_consent?: boolean;
    speed_rating?: "slow" | "medium" | "fast";
    total_time_budget_minutes?: number;
    full_name?: string;
    phone?: string | null;
    availability?: "available" | "unavailable" | "out_in_field";
  };

  const update: Record<string, unknown> = {};
  if (body.completed_welcome) update.completed_welcome_at = new Date().toISOString();
  if (body.commitment_level !== undefined) update.commitment_level = body.commitment_level;
  if (body.next_session_minutes !== undefined)
    update.next_session_minutes = body.next_session_minutes;
  if (body.gps_consent !== undefined) {
    update.gps_consent = body.gps_consent;
    if (body.gps_consent) {
      update.gps_consent_at = new Date().toISOString();
      update.gps_consent_version = body.gps_consent_version ?? "v1";
    }
  }
  if (body.voice_note_consent !== undefined) {
    update.voice_note_consent = body.voice_note_consent;
    if (body.voice_note_consent) update.voice_note_consent_at = new Date().toISOString();
  }
  if (body.speed_rating) update.speed_rating = body.speed_rating;
  if (typeof body.total_time_budget_minutes === "number")
    update.total_time_budget_minutes = body.total_time_budget_minutes;
  if (body.full_name !== undefined) update.full_name = body.full_name;
  if (body.phone !== undefined) update.phone = body.phone;
  if (body.availability) update.availability = body.availability;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }

  const supabase = getSupabaseServiceRoleClient();
  const { error } = await supabase.from("users").update(update).eq("id", session.user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
