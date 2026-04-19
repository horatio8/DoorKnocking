// Shared survey types used by the admin editor, knocker runtime, and API
// routes. Must stay in sync with SURVEYS.md §3.3 and the Supabase enum.

export type SurveyQuestionType =
  | "single_choice"
  | "multi_choice"
  | "short_text"
  | "long_text"
  | "yes_no"
  | "rating_1_5"
  | "scale_0_10";

export interface SurveyOption {
  value: string;
  label: string;
}

export interface SurveyQuestionDraft {
  id?: string;
  question_key: string;
  order_index: number;
  question_text: string;
  question_type: SurveyQuestionType;
  required: boolean;
  help_text: string | null;
  options: SurveyOption[] | null;
  min_value: number | null;
  max_value: number | null;
}

export type SurveyStatus = "draft" | "active" | "paused" | "archived";

export interface SurveyMetaDraft {
  id?: string;
  district_id: string;
  name: string;
  slug: string;
  description: string | null;
  visibility: "all_houses" | "assigned_only";
  priority: number;
  status: SurveyStatus;
  current_version: number;
}

export interface SurveyDraftBundle {
  survey: SurveyMetaDraft;
  questions: SurveyQuestionDraft[];
}

// Which edits flip a published survey back to draft (§5.4).
export interface EditComparison {
  breaking: string[];
  nonBreaking: string[];
}

export function compareSurveys(
  before: SurveyDraftBundle,
  after: SurveyDraftBundle,
): EditComparison {
  const breaking: string[] = [];
  const nonBreaking: string[] = [];

  const byKeyBefore = new Map(before.questions.map((q) => [q.question_key, q]));
  const byKeyAfter = new Map(after.questions.map((q) => [q.question_key, q]));

  for (const [key, q] of byKeyBefore) {
    if (!byKeyAfter.has(key)) {
      breaking.push(`Removed question "${key}"`);
      continue;
    }
    const next = byKeyAfter.get(key)!;
    if (next.question_type !== q.question_type) {
      breaking.push(`Changed type of "${key}"`);
    }
    if (next.question_key !== q.question_key) {
      breaking.push(`Renamed key for "${key}"`);
    }
    if (next.order_index !== q.order_index) {
      breaking.push(`Reordered "${key}"`);
    }
    const beforeOpts = new Set((q.options ?? []).map((o) => o.value));
    const afterOpts = new Set((next.options ?? []).map((o) => o.value));
    for (const v of beforeOpts) {
      if (!afterOpts.has(v)) breaking.push(`Removed option "${v}" from "${key}"`);
    }
    for (const v of afterOpts) {
      if (!beforeOpts.has(v)) nonBreaking.push(`Added option "${v}" to "${key}"`);
    }
    if (next.question_text !== q.question_text) nonBreaking.push(`Polished text for "${key}"`);
    if (next.help_text !== q.help_text) nonBreaking.push(`Edited help text for "${key}"`);
    if (next.required !== q.required) {
      // Going from optional -> required is non-breaking for existing responses
      // (they just can't be partial anymore). Required -> optional is fine.
      nonBreaking.push(`Required flag changed for "${key}"`);
    }
  }
  for (const [key] of byKeyAfter) {
    if (!byKeyBefore.has(key)) nonBreaking.push(`Added question "${key}"`);
  }
  return { breaking, nonBreaking };
}
