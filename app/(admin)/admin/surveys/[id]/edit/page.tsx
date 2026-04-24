import { notFound, redirect } from "next/navigation";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { SurveyEditor } from "@/components/admin/survey-editor";
import type {
  SurveyMetaDraft,
  SurveyQuestionDraft,
  SurveyStatus,
} from "@/lib/surveys/types";

export const dynamic = "force-dynamic";

export default async function SurveyEditPage({ params }: { params: { id: string } }) {
  const session = await loadSession();
  if (!session) redirect("/login");
  if (session.user.role !== "admin" && session.user.role !== "super_admin") redirect("/app");

  const supabase = getSupabaseServiceRoleClient();
  const { data: survey } = await supabase
    .from("surveys")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();
  if (!survey) notFound();

  const { data: questions } = await supabase
    .from("survey_questions")
    .select("*")
    .eq("survey_id", params.id)
    .order("order_index");

  const s = survey as {
    id: string;
    name: string;
    slug: string | null;
    description: string | null;
    district_id: string;
    visibility: "all_houses" | "assigned_only";
    priority: number;
    status: SurveyStatus;
    current_version: number;
  };
  const meta: SurveyMetaDraft = {
    id: s.id,
    district_id: s.district_id,
    name: s.name,
    slug: s.slug ?? "",
    description: s.description,
    visibility: s.visibility,
    priority: s.priority,
    status: s.status,
    current_version: s.current_version,
  };

  const qs: SurveyQuestionDraft[] = ((questions ?? []) as Array<{
    id: string;
    order_index: number;
    question_text: string;
    question_type: SurveyQuestionDraft["question_type"];
    required: boolean;
    options: SurveyQuestionDraft["options"];
    help_text: string | null;
    question_key: string | null;
    min_value: number | null;
    max_value: number | null;
    body_html: string | null;
  }>).map((q) => ({
    id: q.id,
    order_index: q.order_index,
    question_text: q.question_text,
    question_type: q.question_type,
    required: q.required,
    options: q.options ?? null,
    help_text: q.help_text,
    question_key: q.question_key ?? "",
    min_value: q.min_value,
    max_value: q.max_value,
    body_html: q.body_html,
  }));

  // Walkbooks in the survey's district + which ones already have this
  // survey attached. Powers the Step-3-style picker at the bottom of the
  // editor so admins can attach this survey to multiple walkbooks in one
  // go without bouncing to /admin/walkbooks/assign.
  const [{ data: wbRows }, { data: wsRows }] = await Promise.all([
    supabase
      .from("walkbooks")
      .select("id, name, household_count, status, kind")
      .eq("district_id", s.district_id)
      .neq("status", "complete")
      .eq("ephemeral", false)
      .order("name"),
    supabase
      .from("walkbook_surveys")
      .select("walkbook_id")
      .eq("survey_id", params.id),
  ]);
  const walkbooks = ((wbRows ?? []) as Array<{
    id: string;
    name: string;
    household_count: number;
    status: string;
    kind: string;
  }>).map((w) => ({
    id: w.id,
    name: w.name,
    household_count: w.household_count,
    status: w.status,
    kind: w.kind,
  }));
  const attachedWalkbookIds = ((wsRows ?? []) as Array<{ walkbook_id: string }>).map(
    (r) => r.walkbook_id,
  );

  return (
    <SurveyEditor
      meta={meta}
      initialQuestions={qs}
      walkbooks={walkbooks}
      attachedWalkbookIds={attachedWalkbookIds}
    />
  );
}
