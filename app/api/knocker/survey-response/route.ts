import { NextResponse } from "next/server";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";

// POST /api/knocker/survey-response
// Body: { knock_event_id, voter_id, survey_id, question_id, answer, partial }
//
// Persists a single (knock × question) answer to public.survey_responses.
// Composite key (response_id_composite) makes the upsert idempotent so
// a knocker can change their mind on the same question and we don't end
// up with duplicates. Stamps knocker_id + survey_version_number from the
// parent survey.

export async function POST(req: Request) {
  const session = await loadSession();
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as {
    knock_event_id?: string;
    voter_id?: string;
    survey_id?: string;
    question_id?: string;
    answer?: unknown;
    partial?: boolean;
  };
  if (
    !body.knock_event_id ||
    !body.voter_id ||
    !body.survey_id ||
    !body.question_id
  ) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  const supabase = getSupabaseServiceRoleClient();
  const { data: surveyRow } = await supabase
    .from("surveys")
    .select("current_version")
    .eq("id", body.survey_id)
    .maybeSingle();
  const version = (surveyRow as { current_version: number } | null)?.current_version ?? 1;

  const { error } = await supabase
    .from("survey_responses")
    .upsert(
      {
        knock_event_id: body.knock_event_id,
        voter_id: body.voter_id,
        survey_id: body.survey_id,
        question_id: body.question_id,
        answer: body.answer ?? null,
        knocker_id: session.user.id,
        partial: body.partial ?? true,
        survey_version_number: version,
      },
      { onConflict: "knock_event_id,question_id" },
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// PATCH /api/knocker/survey-response  { knock_event_id, complete: true }
// Flips every prior partial=true row for this knock_event to partial=false
// once the knocker hits Finish.
export async function PATCH(req: Request) {
  const session = await loadSession();
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as {
    knock_event_id?: string;
    complete?: boolean;
  };
  if (!body.knock_event_id) {
    return NextResponse.json({ error: "knock_event_id required" }, { status: 400 });
  }
  const supabase = getSupabaseServiceRoleClient();
  await supabase
    .from("survey_responses")
    .update({ partial: !body.complete })
    .eq("knock_event_id", body.knock_event_id)
    .eq("knocker_id", session.user.id);
  await supabase
    .from("knock_events")
    .update({
      survey_completed: Boolean(body.complete),
      survey_partial: !body.complete,
    })
    .eq("id", body.knock_event_id);
  return NextResponse.json({ ok: true });
}
