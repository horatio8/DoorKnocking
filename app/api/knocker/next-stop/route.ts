import { NextResponse } from "next/server";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";

// GET /api/knocker/next-stop?knock_event_id=<uuid>
//
// Powers the "after a survey, highlight the next house" handoff.
// Looks up the just-finished knock event, finds the walkbook + the
// household it was on, then walks `walkbook_households` in
// order_index to return the next household_id. Returns null when the
// knock event isn't tied to a walkbook (free-form knocks via
// /app/map) or when this was the last stop.
//
// Read-only and per-volunteer; service role with role check is fine.
// Anonymous callers get 401 — knock-event ownership matters, since
// this row reveals what the volunteer's been working on.

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await loadSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const knockEventId = url.searchParams.get("knock_event_id");
  if (!knockEventId) {
    return NextResponse.json({ error: "knock_event_id required" }, { status: 400 });
  }

  const supabase = getSupabaseServiceRoleClient();
  const { data: ev } = await supabase
    .from("knock_events")
    .select("id, user_id, walkbook_id, household_id")
    .eq("id", knockEventId)
    .maybeSingle();
  const event = ev as
    | { id: string; user_id: string; walkbook_id: string | null; household_id: string }
    | null;
  if (!event) return NextResponse.json({ error: "knock event not found" }, { status: 404 });
  // Only the owner sees their own queue — admins can hit it for
  // diagnostics if they explicitly want to, but a volunteer can't
  // peek at someone else's flow.
  if (event.user_id !== session.user.id && session.user.role !== "admin" && session.user.role !== "super_admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (!event.walkbook_id) {
    return NextResponse.json({ next_household_id: null, reason: "no_walkbook" });
  }

  // Find the order_index for the just-finished stop, then the next
  // one in the same walkbook. Two-step instead of a single window
  // function so we don't depend on Postgres-specific PostgREST RPCs.
  const { data: stops } = await supabase
    .from("walkbook_households")
    .select("household_id, order_index")
    .eq("walkbook_id", event.walkbook_id)
    .order("order_index", { ascending: true });
  const ordered = (stops ?? []) as Array<{ household_id: string; order_index: number }>;
  const currentIdx = ordered.findIndex((s) => s.household_id === event.household_id);
  if (currentIdx === -1 || currentIdx + 1 >= ordered.length) {
    return NextResponse.json({ next_household_id: null, reason: "end_of_walkbook" });
  }
  const next = ordered[currentIdx + 1]!;
  return NextResponse.json({
    next_household_id: next.household_id,
    walkbook_id: event.walkbook_id,
    order_index: next.order_index,
  });
}
