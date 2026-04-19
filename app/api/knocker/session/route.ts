import { NextResponse } from "next/server";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";

// POST /api/knocker/session   — start a knock session
// PATCH /api/knocker/session  — end it / update counts
// GET   /api/knocker/session  — return the currently open session (if any)

export async function GET() {
  const session = await loadSession();
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const supabase = getSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("knock_sessions")
    .select("*")
    .eq("user_id", session.user.id)
    .is("ended_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ session: data ?? null });
}

export async function POST(req: Request) {
  const session = await loadSession();
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as {
    walkbook_id?: string | null;
    pace_multiplier?: number;
  };
  const supabase = getSupabaseServiceRoleClient();

  // Close any still-open sessions for this user so we don't accumulate orphans.
  await supabase
    .from("knock_sessions")
    .update({ ended_at: new Date().toISOString() })
    .eq("user_id", session.user.id)
    .is("ended_at", null);

  const { data, error } = await supabase
    .from("knock_sessions")
    .insert({
      user_id: session.user.id,
      walkbook_id: body.walkbook_id ?? null,
      pace_multiplier: body.pace_multiplier ?? 1.0,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ session: data });
}

export async function PATCH(req: Request) {
  const session = await loadSession();
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as {
    session_id?: string;
    end?: boolean;
    knock_count?: number;
    duration_seconds?: number;
    walking_coherence_score?: number;
    flagged_for_review?: boolean;
    flag_reason?: string;
  };
  if (!body.session_id) {
    return NextResponse.json({ error: "session_id required" }, { status: 400 });
  }
  const update: Record<string, unknown> = {};
  if (body.end) update.ended_at = new Date().toISOString();
  if (typeof body.knock_count === "number") update.knock_count = body.knock_count;
  if (typeof body.duration_seconds === "number") update.duration_seconds = body.duration_seconds;
  if (typeof body.walking_coherence_score === "number")
    update.walking_coherence_score = body.walking_coherence_score;
  if (typeof body.flagged_for_review === "boolean") update.flagged_for_review = body.flagged_for_review;
  if (body.flag_reason !== undefined) update.flag_reason = body.flag_reason;

  const supabase = getSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("knock_sessions")
    .update(update)
    .eq("id", body.session_id)
    .eq("user_id", session.user.id)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ session: data });
}
