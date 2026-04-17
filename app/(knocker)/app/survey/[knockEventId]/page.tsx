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

  return (
    <SurveyRunner
      knockEventId={event.id}
      voter={event.voters!}
      survey={event.surveys!}
    />
  );
}
