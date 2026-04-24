import Link from "next/link";
import { redirect } from "next/navigation";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { KnockEvent, Survey, SurveyQuestion, Voter } from "@/lib/types";
import { SurveyRunner } from "@/components/knocker/survey-runner";

export const dynamic = "force-dynamic";

export default async function SurveyPage({ params }: { params: { knockEventId: string } }) {
  const session = await loadSession();
  if (!session) redirect("/login");
  // Service-role client bypasses RLS so the volunteer's district_access
  // doesn't gate the lookup. The session check above is the auth guard.
  const supabase = getSupabaseServiceRoleClient();

  // The URL segment is the client-generated UUID. After the recordKnock
  // fix that's now stored as the row's `id` AND its `client_event_id`,
  // so a lookup by `id` should always hit. Older rows from before the
  // fix only have `client_event_id` matching, so try that as a fallback
  // before declaring the knock missing.
  let { data: knock } = await supabase
    .from("knock_events")
    .select("*, voters(*), surveys(*, survey_questions(*))")
    .eq("id", params.knockEventId)
    .maybeSingle();
  if (!knock) {
    const fallback = await supabase
      .from("knock_events")
      .select("*, voters(*), surveys(*, survey_questions(*))")
      .eq("client_event_id", params.knockEventId)
      .maybeSingle();
    knock = fallback.data;
  }
  if (!knock) {
    // The knock genuinely isn't there — likely the outbox flush hasn't
    // landed yet (volunteer was offline, or sync failed silently). Give
    // them a useful path forward instead of a bare 404.
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="font-serif text-xl font-semibold text-navy-900">
          Couldn&rsquo;t find that knock
        </h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          The knock you&rsquo;re trying to survey hasn&rsquo;t synced to the server yet, or
          something else went wrong. Wait a few seconds and reload, or head back to the map.
        </p>
        <p className="font-mono text-[10px] text-muted-foreground">
          ref: {params.knockEventId}
        </p>
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
  const event = knock as KnockEvent & {
    voters: Voter | null;
    surveys: (Survey & { survey_questions: SurveyQuestion[] }) | null;
  };
  if (!event.surveys || !event.voters) {
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

  return (
    <SurveyRunner
      knockEventId={event.id}
      voter={event.voters!}
      survey={event.surveys!}
      initialAnswers={initialAnswers}
    />
  );
}
