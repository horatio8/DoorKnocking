import Link from "next/link";
import { redirect } from "next/navigation";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { KnockEvent, Survey, SurveyQuestion, Voter } from "@/lib/types";
import { SurveyRunner } from "@/components/knocker/survey-runner";

export const dynamic = "force-dynamic";

// Server-side back-off for the case where the runner page renders a
// few hundred ms before the knock_event row is visible to the next
// read. Happens on cold Vercel nodes where the read hits a replica
// that hasn't caught up, or when the POST + this render race on
// different edge locations. Four attempts over ~3 seconds with
// doubling waits covers the realistic lag window without stranding
// the volunteer for long on genuine failures.
const LOOKUP_ATTEMPT_DELAYS_MS = [0, 250, 750, 2000];

interface KnockEventJoined extends KnockEvent {
  voters: Voter | null;
  surveys: (Survey & { survey_questions: SurveyQuestion[] }) | null;
}

export default async function SurveyPage({ params }: { params: { knockEventId: string } }) {
  const session = await loadSession();
  if (!session) redirect("/login");
  // Service-role client bypasses RLS so the volunteer's district_access
  // doesn't gate the lookup. The session check above is the auth guard.
  const supabase = getSupabaseServiceRoleClient();
  const startedAt = Date.now();

  // Look up by id first, then by client_event_id for rows inserted
  // before we started preserving the id. Retry a few times with
  // back-off so replication lag doesn't send the volunteer to the
  // dead-end screen for transient misses.
  //
  // The `voters!voter_id` and `surveys!survey_id` hints disambiguate
  // PostgREST embeds: knock_events has TWO foreign keys to voters
  // (voter_id forward + the trigger-set last_knock_event_id reverse),
  // and naked `voters(*)` returns HTTP 300 ambiguous-relationship
  // — which we used to swallow as "row not found", dead-ending every
  // contacted-status knock right after the trigger fired.
  const SELECT_JOINED =
    "*, voters!voter_id(*), surveys!survey_id(*, survey_questions(*))";
  let knock: KnockEventJoined | null = null;
  let attemptsTried = 0;
  let lastEmbedError: string | null = null;
  for (const wait of LOOKUP_ATTEMPT_DELAYS_MS) {
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    attemptsTried += 1;
    const byId = await supabase
      .from("knock_events")
      .select(SELECT_JOINED)
      .eq("id", params.knockEventId)
      .maybeSingle();
    if (byId.error) {
      lastEmbedError = byId.error.message;
      console.error("[survey:runner-page] embed error on id lookup", {
        knockEventId: params.knockEventId,
        attempt: attemptsTried,
        code: (byId.error as { code?: string }).code ?? null,
        message: byId.error.message,
        hint: (byId.error as { hint?: string }).hint ?? null,
      });
    }
    if (byId.data) {
      knock = byId.data as unknown as KnockEventJoined;
      break;
    }
    const byClientId = await supabase
      .from("knock_events")
      .select(SELECT_JOINED)
      .eq("client_event_id", params.knockEventId)
      .maybeSingle();
    if (byClientId.error) {
      lastEmbedError = byClientId.error.message;
      console.error("[survey:runner-page] embed error on client_event_id lookup", {
        knockEventId: params.knockEventId,
        attempt: attemptsTried,
        code: (byClientId.error as { code?: string }).code ?? null,
        message: byClientId.error.message,
      });
    }
    if (byClientId.data) {
      knock = byClientId.data as unknown as KnockEventJoined;
      break;
    }
    console.info("[survey:runner-page] lookup miss", {
      knockEventId: params.knockEventId,
      attempt: attemptsTried,
      waitedMs: wait,
      elapsedMs: Date.now() - startedAt,
      hadEmbedError: Boolean(lastEmbedError),
    });
  }
  if (!knock) {
    // Best-effort "what do we know?" so the error page can show
    // actionable info instead of a bare ref. We probe knock_events
    // once with every search key we have; if the row genuinely
    // doesn't exist the counts are all zero.
    const [byIdProbe, byClientProbe, recentSameUser] = await Promise.all([
      supabase
        .from("knock_events")
        .select("id", { count: "exact", head: true })
        .eq("id", params.knockEventId),
      supabase
        .from("knock_events")
        .select("id", { count: "exact", head: true })
        .eq("client_event_id", params.knockEventId),
      supabase
        .from("knock_events")
        .select("id, client_event_id, created_at")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false })
        .limit(3),
    ]);
    const mostRecent =
      (recentSameUser.data ?? []) as Array<{
        id: string;
        client_event_id: string | null;
        created_at: string;
      }>;
    console.warn("[survey:runner-page] knock event not found after retries", {
      knockEventId: params.knockEventId,
      userId: session.user.id,
      attempts: attemptsTried,
      totalWaitMs: Date.now() - startedAt,
      byIdMatchCount: byIdProbe.count ?? 0,
      byClientEventIdMatchCount: byClientProbe.count ?? 0,
      mostRecentForUser: mostRecent.map((r) => ({
        id: r.id,
        clientEventId: r.client_event_id,
        createdAt: r.created_at,
      })),
    });
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="font-serif text-xl font-semibold text-navy-900">
          Couldn&rsquo;t find that knock
        </h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          The server doesn&rsquo;t have a record of this knock even after {attemptsTried} checks.
          Usually that means the save was blocked before it reached the server — head back
          and the door screen will show the exact reason when you try again.
        </p>
        <p className="font-mono text-[10px] text-muted-foreground">
          ref: {params.knockEventId}
        </p>
        <p className="max-w-sm text-[11px] text-muted-foreground">
          Debug: checked {attemptsTried} times over {Date.now() - startedAt}ms ·
          {" "}
          id matches: {byIdProbe.count ?? 0}
          {" · "}
          client_event_id matches: {byClientProbe.count ?? 0}
          {mostRecent[0]
            ? ` · your most recent synced knock is ref ${mostRecent[0].id} (${new Date(mostRecent[0].created_at).toISOString()})`
            : " · no recent knocks found for your account"}
        </p>
        {lastEmbedError ? (
          <p className="max-w-sm rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-900">
            Embed error (visible row but join failed): {lastEmbedError}
          </p>
        ) : null}
        <div className="flex gap-2">
          <Link
            href={`/app/survey/${params.knockEventId}`}
            className="inline-flex items-center rounded-md bg-navy-900 px-3 py-2 text-sm font-semibold text-white"
          >
            Try again
          </Link>
          <Link
            href="/app/map"
            className="inline-flex items-center rounded-md border border-navy-200 bg-white px-3 py-2 text-sm font-semibold text-navy-700"
          >
            Back to map
          </Link>
        </div>
      </div>
    );
  }
  const event = knock;
  if (!event.surveys || !event.voters) {
    console.warn("[survey:runner-page] event found but join missing", {
      knockEventId: params.knockEventId,
      eventId: event.id,
      hasSurveys: Boolean(event.surveys),
      hasVoter: Boolean(event.voters),
      surveyId: (event as { survey_id?: string | null }).survey_id ?? null,
      voterId: (event as { voter_id?: string | null }).voter_id ?? null,
    });
    // Silent-redirect used to strand the volunteer with no explanation;
    // a proper empty state is less confusing.
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="font-serif text-xl font-semibold text-navy-900">
          Nothing to survey here.
        </h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          There&rsquo;s no active survey attached to this knock yet. Your answers and notes are
          safe — ask your admin to publish a survey and try again.
        </p>
        <Link
          href="/app/map"
          className="inline-flex items-center rounded-md bg-navy-900 px-3 py-2 text-sm font-semibold text-white"
        >
          Back to map
        </Link>
      </div>
    );
  }

  // Resume support — pull any existing answers for this knock so the
  // runner can pre-populate them. Spec §6.5: within 24h.
  const { data: prior } = await supabase
    .from("survey_responses")
    .select("question_id, answer")
    .eq("knock_event_id", event.id);
  const initialAnswers: Record<string, unknown> = {};
  for (const r of (prior ?? []) as Array<{ question_id: string; answer: unknown }>) {
    initialAnswers[r.question_id] = r.answer;
  }

  console.info("[survey:runner-page] rendering runner", {
    knockEventId: params.knockEventId,
    eventId: event.id,
    surveyId: event.surveys.id,
    surveyStatus: (event.surveys as { status?: string }).status ?? null,
    questionCount: event.surveys.survey_questions?.length ?? 0,
    priorAnswerCount: Object.keys(initialAnswers).length,
  });

  return (
    <SurveyRunner
      knockEventId={event.id}
      voter={event.voters!}
      survey={event.surveys!}
      initialAnswers={initialAnswers}
    />
  );
}
