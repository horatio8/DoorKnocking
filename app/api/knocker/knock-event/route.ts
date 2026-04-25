import { NextResponse } from "next/server";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";

// POST /api/knocker/knock-event
//
// Server-side path for committing a knock_event when the volunteer is
// online. Replaces the browser RLS upsert that was silently failing
// on some installs (FK / enum / trigger errors swallowed by the
// outbox flush, leaving the volunteer at the runner's "Couldn't
// find that knock" dead end).
//
// Request body mirrors the offline outbox payload: the client passes
// the same UUID for both `id` and `client_event_id` so the runner
// can navigate to /app/survey/<id> immediately after this returns.
//
// Errors come back with shape { error, detail? } and a 4xx/5xx status
// the client raises into a real on-screen message — no more silent
// loss.

export const dynamic = "force-dynamic";

interface Body {
  id?: string;
  client_event_id?: string;
  household_id?: string;
  voter_id?: string | null;
  user_id?: string;
  walkbook_id?: string | null;
  status?: string;
  knocked_at?: string;
  duration_seconds?: number | null;
  notes?: string | null;
  survey_id?: string | null;
}

export async function POST(req: Request) {
  const session = await loadSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as Body;

  if (!body.id || !body.client_event_id) {
    return NextResponse.json(
      { error: "id and client_event_id are required" },
      { status: 400 },
    );
  }
  if (!body.household_id) {
    return NextResponse.json(
      { error: "household_id is required" },
      { status: 400 },
    );
  }
  if (!body.status) {
    return NextResponse.json({ error: "status is required" }, { status: 400 });
  }
  if (!body.knocked_at) {
    return NextResponse.json({ error: "knocked_at is required" }, { status: 400 });
  }
  // Force the user_id to the authenticated session user so a
  // compromised client can't insert events under someone else's id.
  const userId = session.user.id;

  const supabase = getSupabaseServiceRoleClient();
  const payload = {
    id: body.id,
    client_event_id: body.client_event_id,
    household_id: body.household_id,
    voter_id: body.voter_id ?? null,
    user_id: userId,
    walkbook_id: body.walkbook_id ?? null,
    status: body.status,
    knocked_at: body.knocked_at,
    duration_seconds: body.duration_seconds ?? null,
    notes: body.notes ?? null,
    survey_id: body.survey_id ?? null,
  };

  const { data, error } = await supabase
    .from("knock_events")
    .upsert(payload, { onConflict: "client_event_id" })
    .select(
      "id, client_event_id, household_id, voter_id, user_id, walkbook_id, status, knocked_at, duration_seconds, notes, survey_id, survey_completed, survey_partial, conflict_flag, synced_at, created_at",
    )
    .single();
  if (error) {
    console.error("[survey:knock-event-api] upsert failed", {
      knockEventId: body.id,
      surveyId: body.survey_id,
      code: (error as { code?: string }).code ?? null,
      message: error.message,
    });
    return NextResponse.json(
      {
        error: "could not save knock",
        detail: error.message,
        code: (error as { code?: string }).code ?? null,
      },
      { status: 500 },
    );
  }

  console.info("[survey:knock-event-api] inserted", {
    knockEventId: data.id,
    surveyId: data.survey_id,
    status: data.status,
    voterId: data.voter_id,
  });
  return NextResponse.json({ event: data });
}
