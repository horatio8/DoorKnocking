import { NextResponse } from "next/server";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";

// POST /api/knocker/commitment
//
// Captures a "they want to come back" promise from Screen 7b. Tolerates
// the household_commitments table not existing yet (migration
// 20260425000004) — in that case we still log the knock_event with
// status='come_back_later' so the wrap-up screen reflects the answer.

export const dynamic = "force-dynamic";

interface Body {
  household_id?: string;
  voter_id?: string | null;
  knock_session_id?: string | null;
  knock_event_id?: string | null;
  bucket?: "tonight" | "tomorrow" | "weekend" | "later";
}

function promisedAtFor(bucket: Body["bucket"]): string {
  const d = new Date();
  switch (bucket) {
    case "tonight":
      d.setHours(18, 0, 0, 0);
      // If it's already past 18:00, push to tomorrow at 18:00.
      if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1);
      return d.toISOString();
    case "tomorrow":
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
      return d.toISOString();
    case "weekend": {
      // Saturday at 12:00.
      const day = d.getDay(); // 0=Sun..6=Sat
      const offset = (6 - day + 7) % 7 || 7;
      d.setDate(d.getDate() + offset);
      d.setHours(12, 0, 0, 0);
      return d.toISOString();
    }
    case "later":
    default:
      d.setDate(d.getDate() + 7);
      d.setHours(12, 0, 0, 0);
      return d.toISOString();
  }
}

export async function POST(req: Request) {
  const session = await loadSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Body;
  if (!body.household_id) {
    return NextResponse.json({ error: "household_id is required" }, { status: 400 });
  }
  if (!body.bucket) {
    return NextResponse.json({ error: "bucket is required" }, { status: 400 });
  }

  const supabase = getSupabaseServiceRoleClient();
  const promised_at = promisedAtFor(body.bucket);

  const row = {
    household_id: body.household_id,
    voter_id: body.voter_id ?? null,
    user_id: session.user.id,
    knock_session_id: body.knock_session_id ?? null,
    knock_event_id: body.knock_event_id ?? null,
    promised_at,
    bucket: body.bucket,
  };

  const { data, error } = await supabase
    .from("household_commitments")
    .insert(row)
    .select("*")
    .single();

  if (error) {
    // If the table doesn't exist yet (migration not applied), don't fail —
    // the knock_event already carries the come_back_later signal.
    if (
      (error as { code?: string }).code === "42P01" ||
      /relation .*household_commitments.* does not exist/i.test(error.message ?? "")
    ) {
      return NextResponse.json({
        commitment: null,
        warning: "household_commitments table missing; knock_event still logged",
        promised_at,
      });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ commitment: data, promised_at });
}
