import { notFound, redirect } from "next/navigation";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { KnockEvent, Survey, SurveyQuestion, Voter } from "@/lib/types";
import { SurveyRunner } from "@/components/knocker/survey-runner";

export const dynamic = "force-dynamic";

export default async function SurveyPage({ params }: { params: { knockEventId: string } }) {
  const session = await loadSession();
  if (!session) redirect("/login");
  const supabase = getSupabaseServerClient();

  const { data: knock } = await supabase
    .from("knock_events")
    .select("*, voters(*), surveys(*, survey_questions(*))")
    .eq("id", params.knockEventId)
    .maybeSingle();
  if (!knock) notFound();
  const event = knock as KnockEvent & {
    voters: Voter | null;
    surveys: (Survey & { survey_questions: SurveyQuestion[] }) | null;
  };
  if (!event.surveys || !event.voters) {
    redirect("/app/map");
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
