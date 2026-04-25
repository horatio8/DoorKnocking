// Resolves the set of surveys a volunteer can run at a given door.
//
// The behaviour the door wants:
//   - If 1+ surveys are reasonable, present them for selection (the
//     household-detail UI auto-launches when there's only one and
//     shows a picker when there are 2+).
//   - If none, the volunteer can still save a knock with notes /
//     tags / voice-note — the household UI handles the empty case.
//
// Resolution order:
//   1. session.chosen_survey_id — locked-in choice when the
//      volunteer started a walkbook session with a specific survey.
//      Returns a single-element list so the picker auto-selects.
//   2. walkbook_surveys attached to the volunteer's active walkbook,
//      filtered to non-archived. Multiple = picker; one = auto.
//   3. District 'active' surveys. Multiple = picker.
//   4. Fallback: district 'draft' surveys with at least one
//      question. Volunteers can still test unpublished work
//      (household-detail surfaces a "this is a draft" banner).
//
// All paths exclude archived surveys. Empty drafts are excluded
// because the runner has nothing to render. Returns the surveys with
// their questions joined for the runner.
//
// Service-role client expected — caller decides RLS posture.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Survey, SurveyQuestion } from "@/lib/types";

export type SurveyWithQuestions = Survey & { survey_questions: SurveyQuestion[] };

export interface ResolveContext {
  districtId: string;
  chosenSurveyId: string | null;
  walkbookId: string | null;
}

interface RawSurvey {
  id: string;
  district_id: string;
  airtable_survey_id: string | null;
  name: string;
  description: string | null;
  active: boolean;
  status: string;
  visibility: string;
  priority: number;
  created_at: string;
  updated_at: string;
  survey_questions: SurveyQuestion[] | null;
}

const SELECT_SURVEY = "*, survey_questions(*)";

function nonArchived(s: RawSurvey): boolean {
  return s.status !== "archived";
}

function hasQuestions(s: RawSurvey): boolean {
  return Array.isArray(s.survey_questions) && s.survey_questions.length > 0;
}

// Survey runner needs at least one question to render anything
// useful — an empty active survey is just as broken as an empty
// draft, but previously only drafts were filtered. Without this an
// admin who saved an empty active survey would shadow every other
// option (resolver returns it; runner shows "No questions configured.").
function usable(s: RawSurvey): boolean {
  return nonArchived(s) && hasQuestions(s);
}

function asSurveyWithQuestions(s: RawSurvey): SurveyWithQuestions {
  return {
    id: s.id,
    district_id: s.district_id,
    airtable_survey_id: s.airtable_survey_id,
    name: s.name,
    description: s.description,
    active: s.active,
    status: s.status as SurveyWithQuestions["status"],
    visibility: s.visibility as SurveyWithQuestions["visibility"],
    priority: s.priority,
    created_at: s.created_at,
    updated_at: s.updated_at,
    survey_questions: s.survey_questions ?? [],
  };
}

export async function resolveAvailableSurveys(
  supabase: SupabaseClient,
  ctx: ResolveContext,
): Promise<SurveyWithQuestions[]> {
  // 1. chosen_survey_id wins (locked by the walkbook session).
  if (ctx.chosenSurveyId) {
    const { data } = await supabase
      .from("surveys")
      .select(SELECT_SURVEY)
      .eq("id", ctx.chosenSurveyId)
      .maybeSingle();
    const row = (data ?? null) as RawSurvey | null;
    if (row && usable(row)) {
      console.info("[survey:resolver] picked chosen_survey_id", {
        chosenSurveyId: ctx.chosenSurveyId,
        surveyId: row.id,
        status: row.status,
        questionCount: row.survey_questions?.length ?? 0,
      });
      return [asSurveyWithQuestions(row)];
    }
    console.info("[survey:resolver] chosen_survey_id did not resolve", {
      chosenSurveyId: ctx.chosenSurveyId,
      reason: !row
        ? "survey not found"
        : !nonArchived(row)
          ? "archived"
          : "no questions",
    });
  }

  // 2. Walkbook attachments — pinned + priority order.
  if (ctx.walkbookId) {
    const { data: attachments } = await supabase
      .from("walkbook_surveys")
      .select("survey_id, pinned, priority")
      .eq("walkbook_id", ctx.walkbookId)
      .order("pinned", { ascending: false })
      .order("priority", { ascending: false });
    const ids = ((attachments ?? []) as Array<{ survey_id: string }>).map((r) => r.survey_id);
    if (ids.length > 0) {
      const { data: rows } = await supabase
        .from("surveys")
        .select(SELECT_SURVEY)
        .in("id", ids);
      const out = ((rows ?? []) as RawSurvey[]).filter(usable);
      if (out.length > 0) {
        console.info("[survey:resolver] picked walkbook attachments", {
          walkbookId: ctx.walkbookId,
          attachmentCount: ids.length,
          usableCount: out.length,
          surveyIds: out.map((s) => s.id),
        });
        return out.map(asSurveyWithQuestions);
      }
      console.info("[survey:resolver] walkbook attachments unusable", {
        walkbookId: ctx.walkbookId,
        attachmentCount: ids.length,
        rowCount: (rows ?? []).length,
      });
    }
  }

  // 3. District 'active' surveys.
  const { data: activeRows } = await supabase
    .from("surveys")
    .select(SELECT_SURVEY)
    .eq("district_id", ctx.districtId)
    .eq("status", "active")
    .order("priority", { ascending: false });
  const activeList = ((activeRows ?? []) as RawSurvey[]).filter(usable);
  if (activeList.length > 0) {
    console.info("[survey:resolver] picked district active", {
      districtId: ctx.districtId,
      count: activeList.length,
      surveyIds: activeList.map((s) => s.id),
    });
    return activeList.map(asSurveyWithQuestions);
  }
  console.info("[survey:resolver] no usable active surveys", {
    districtId: ctx.districtId,
    rawActive: (activeRows ?? []).length,
  });

  // 4. Fallback to drafts that have content.
  const { data: draftRows } = await supabase
    .from("surveys")
    .select(SELECT_SURVEY)
    .eq("district_id", ctx.districtId)
    .eq("status", "draft")
    .order("updated_at", { ascending: false });
  const drafts = ((draftRows ?? []) as RawSurvey[]).filter(usable);
  if (drafts.length > 0) {
    console.info("[survey:resolver] picked draft fallback", {
      districtId: ctx.districtId,
      count: drafts.length,
      surveyIds: drafts.map((s) => s.id),
    });
    return drafts.map(asSurveyWithQuestions);
  }
  console.info("[survey:resolver] empty — no usable survey resolved", {
    districtId: ctx.districtId,
    rawDrafts: (draftRows ?? []).length,
  });
  return [];
}
