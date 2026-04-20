import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { anthropicEnv } from "@/lib/env";
import { toSlug, ensureUniqueSlug } from "@/lib/surveys/slug";
import type { SurveyQuestionDraft, SurveyQuestionType } from "@/lib/surveys/types";

// POST /api/admin/surveys/from-brief
// Body: { districtId, brief, name? }
//
// Takes a free-form statement/brief from the admin and asks Claude to turn
// it into a draft survey — survey name, description, and a list of
// structured questions. We write the draft + questions into Supabase and
// return the new survey id so the client can route straight into the
// editor for a human pass before publishing.

const MODEL = "claude-sonnet-4-6";

const SYSTEM_PROMPT = `You are a canvassing-survey designer for a door-to-door political organising tool.
The user will describe what they want to learn from voters in plain language.
Your job: return a ready-to-edit survey with 3–8 well-targeted questions.

Constraints, no exceptions:
- Output must be valid JSON matching the schema you receive. No prose.
- Question text must be short (under 20 words), doorstep-friendly, plain English.
- Use the most appropriate question_type from the allowed list. Default to single_choice when in doubt.
- Choice questions MUST include 2–6 options. Options are concrete answers the voter can pick, not meta-instructions.
- Include a rating (1–5) or scale (0–10) question when the brief talks about degrees, strength of support, or likelihood.
- Every question_key is unique within the survey, lowercase snake_case, <= 32 chars.
- Set required=true only for the core 1–2 questions that define the survey's usefulness; everything else is optional.
- If the brief doesn't imply a clear name, pick a short descriptive name ("HD115 Top Issues", not "Survey about voters").
- Do NOT invent data, candidate names, or policy positions beyond what the brief specifies.`;

const ALLOWED_TYPES: SurveyQuestionType[] = [
  "single_choice",
  "multi_choice",
  "short_text",
  "long_text",
  "yes_no",
  "rating_1_5",
  "scale_0_10",
];

// Response JSON schema we ask Claude to follow. Kept in sync with
// SurveyQuestionDraft so we can upsert directly.
const SCHEMA_DESCRIPTION = `{
  "name": "<short survey name>",
  "description": "<1-2 sentence description>",
  "questions": [
    {
      "question_key": "snake_case_key",
      "question_text": "short doorstep question",
      "question_type": "single_choice|multi_choice|short_text|long_text|yes_no|rating_1_5|scale_0_10",
      "required": true|false,
      "help_text": "optional hint or null",
      "options": [ { "value": "snake_case", "label": "What the voter sees" } ]  // only for choice types, else null
    }
  ]
}`;

export async function POST(req: Request) {
  const session = await loadSession();
  if (!session || (session.user.role !== "admin" && session.user.role !== "super_admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    districtId?: string;
    brief?: string;
    name?: string;
  };
  const districtId = body.districtId ?? session.district?.id;
  if (!districtId) return NextResponse.json({ error: "districtId required" }, { status: 400 });
  if (!body.brief || body.brief.trim().length < 12) {
    return NextResponse.json(
      { error: "brief too short — describe what you want to learn in at least one sentence" },
      { status: 400 },
    );
  }

  // Call Claude with the brief, asking for JSON-only output.
  let parsed: {
    name?: string;
    description?: string;
    questions?: Array<Record<string, unknown>>;
  };
  try {
    const client = new Anthropic({ apiKey: anthropicEnv().apiKey });
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content:
            `Return a JSON object that matches this schema exactly:\n\n${SCHEMA_DESCRIPTION}\n\n` +
            `Brief:\n"""${body.brief.trim()}"""`,
        },
      ],
    });
    const text = resp.content
      .map((c) => (c.type === "text" ? c.text : ""))
      .join("")
      .trim();
    // Pull the first {...} block out in case the model wraps it in prose.
    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}");
    if (jsonStart < 0 || jsonEnd <= jsonStart) throw new Error("no JSON in response");
    parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1)) as typeof parsed;
  } catch (err) {
    console.error("from-brief: claude call failed", err);
    return NextResponse.json(
      { error: `Claude call failed: ${(err as Error).message}` },
      { status: 502 },
    );
  }

  // Defensive validation — we don't trust LLM output blindly.
  const rawQuestions = Array.isArray(parsed.questions) ? parsed.questions : [];
  const usedKeys = new Set<string>();
  const questions: SurveyQuestionDraft[] = [];
  for (const q of rawQuestions) {
    const type = String(q.question_type ?? "").trim() as SurveyQuestionType;
    if (!ALLOWED_TYPES.includes(type)) continue;
    const text = String(q.question_text ?? "").trim();
    if (!text) continue;
    let key = toSlug(String(q.question_key ?? text).trim()).slice(0, 32);
    if (!key) continue;
    if (usedKeys.has(key)) key = ensureUniqueSlug(key, usedKeys).slice(0, 32);
    usedKeys.add(key);

    let options: SurveyQuestionDraft["options"] = null;
    if (type === "single_choice" || type === "multi_choice") {
      const opts = Array.isArray(q.options) ? q.options : [];
      const cleaned = opts
        .map((o) => {
          const r = o as { value?: unknown; label?: unknown };
          const label = String(r.label ?? "").trim();
          const value = toSlug(String(r.value ?? label));
          return value && label ? { value, label } : null;
        })
        .filter((o): o is { value: string; label: string } => o !== null);
      if (cleaned.length < 2) continue; // choice without options is useless
      options = cleaned.slice(0, 8);
    }

    let min_value: number | null = null;
    let max_value: number | null = null;
    if (type === "rating_1_5") {
      min_value = 1;
      max_value = 5;
    } else if (type === "scale_0_10") {
      min_value = 0;
      max_value = 10;
    }

    questions.push({
      question_key: key,
      order_index: questions.length + 1,
      question_text: text,
      question_type: type,
      required: Boolean(q.required),
      help_text:
        typeof q.help_text === "string" && q.help_text.trim().length > 0
          ? String(q.help_text).trim()
          : null,
      options,
      min_value,
      max_value,
    });
    if (questions.length >= 12) break;
  }

  if (questions.length === 0) {
    return NextResponse.json(
      { error: "Claude didn't return any usable questions — try rewording the brief." },
      { status: 422 },
    );
  }

  const surveyName = (body.name?.trim() || parsed.name?.trim() || "Untitled survey").slice(0, 96);
  const description =
    typeof parsed.description === "string" && parsed.description.trim().length > 0
      ? parsed.description.trim()
      : null;

  // Allocate a unique slug in the district.
  const supabase = getSupabaseServiceRoleClient();
  const { data: existingSlugs } = await supabase
    .from("surveys")
    .select("slug")
    .eq("district_id", districtId);
  const taken = ((existingSlugs ?? []) as Array<{ slug: string | null }>)
    .map((r) => r.slug)
    .filter((s): s is string => Boolean(s));
  const slug = ensureUniqueSlug(toSlug(surveyName), taken);

  const { data: survey, error: sErr } = await supabase
    .from("surveys")
    .insert({
      district_id: districtId,
      name: surveyName,
      slug,
      description,
      status: "draft",
      active: false,
      created_by: session.user.id,
    })
    .select("id")
    .single();
  if (sErr || !survey) {
    return NextResponse.json({ error: sErr?.message ?? "create failed" }, { status: 500 });
  }

  const rows = questions.map((q) => ({
    survey_id: survey.id as string,
    order_index: q.order_index,
    question_text: q.question_text,
    question_type: q.question_type,
    required: q.required,
    options: q.options ?? null,
    help_text: q.help_text,
    question_key: q.question_key,
    min_value: q.min_value,
    max_value: q.max_value,
  }));
  const { error: qErr } = await supabase.from("survey_questions").insert(rows);
  if (qErr) {
    return NextResponse.json({ error: `questions: ${qErr.message}` }, { status: 500 });
  }

  // Log the generation for auditing / cost tracking.
  await supabase.from("ai_suggestions").insert({
    user_id: session.user.id,
    kind: "walkbook_suggestion", // reuse enum bucket — no new enum value yet
    input: { brief: body.brief.trim(), survey_id: survey.id },
    output: { name: surveyName, question_count: questions.length },
    model: MODEL,
  });

  return NextResponse.json({
    id: survey.id as string,
    slug,
    name: surveyName,
    questionCount: questions.length,
  });
}
