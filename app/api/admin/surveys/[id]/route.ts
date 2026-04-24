import { NextResponse } from "next/server";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { toSlug, ensureUniqueSlug } from "@/lib/surveys/slug";
import type { SurveyQuestionDraft, SurveyStatus } from "@/lib/surveys/types";
import { compareSurveys } from "@/lib/surveys/types";

// GET     /api/admin/surveys/:id     — fetch full survey (meta + questions)
// PATCH   /api/admin/surveys/:id     — update meta + replace questions
// DELETE  /api/admin/surveys/:id     — archive (soft-delete by setting status)

async function requireAdmin() {
  const session = await loadSession();
  if (!session || (session.user.role !== "admin" && session.user.role !== "super_admin")) {
    return null;
  }
  return session;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const supabase = getSupabaseServiceRoleClient();
  const { data: survey } = await supabase
    .from("surveys")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();
  if (!survey) return NextResponse.json({ error: "not found" }, { status: 404 });
  const { data: questions } = await supabase
    .from("survey_questions")
    .select("*")
    .eq("survey_id", params.id)
    .order("order_index");
  return NextResponse.json({ survey, questions: questions ?? [] });
}

interface PatchBody {
  name?: string;
  description?: string | null;
  visibility?: "all_houses" | "assigned_only";
  priority?: number;
  questions?: SurveyQuestionDraft[];
  force?: boolean;
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as PatchBody;
  const supabase = getSupabaseServiceRoleClient();

  const { data: existing } = await supabase
    .from("surveys")
    .select("id, district_id, status, slug, current_version")
    .eq("id", params.id)
    .maybeSingle();
  const current = existing as
    | {
        id: string;
        district_id: string;
        status: SurveyStatus;
        slug: string | null;
        current_version: number;
      }
    | null;
  if (!current) return NextResponse.json({ error: "not found" }, { status: 404 });

  const update: Record<string, unknown> = {};
  if (body.name !== undefined) update.name = body.name.trim();
  if (body.description !== undefined) update.description = body.description;
  if (body.visibility !== undefined) update.visibility = body.visibility;
  if (body.priority !== undefined) update.priority = body.priority;

  // Re-slug on rename (but keep old slug if nothing changes, so historical
  // Airtable links remain intact).
  if (body.name !== undefined) {
    const { data: peers } = await supabase
      .from("surveys")
      .select("slug")
      .eq("district_id", current.district_id)
      .neq("id", current.id);
    const taken = ((peers ?? []) as Array<{ slug: string | null }>)
      .map((r) => r.slug)
      .filter((s): s is string => Boolean(s));
    const candidate = toSlug(body.name);
    if (current.slug !== candidate) {
      update.slug = ensureUniqueSlug(candidate, taken);
    }
  }

  // Replace the question set. For active surveys we run the diff and, unless
  // `force` is set, we reject breaking edits with the list of problems so the
  // admin UI can prompt for a version bump.
  let diff: ReturnType<typeof compareSurveys> | null = null;
  if (body.questions) {
    if (current.status === "active" && !body.force) {
      const { data: prev } = await supabase
        .from("survey_questions")
        .select("*")
        .eq("survey_id", current.id)
        .order("order_index");
      const prevQs = ((prev ?? []) as Array<{
        question_key: string | null;
        order_index: number;
        question_text: string;
        question_type: SurveyQuestionDraft["question_type"];
        required: boolean;
        help_text: string | null;
        options: SurveyQuestionDraft["options"];
        min_value: number | null;
        max_value: number | null;
        body_html: string | null;
      }>)
        .filter((q) => q.question_key)
        .map((q) => ({
          question_key: q.question_key!,
          order_index: q.order_index,
          question_text: q.question_text,
          question_type: q.question_type,
          required: q.required,
          help_text: q.help_text,
          options: q.options,
          min_value: q.min_value,
          max_value: q.max_value,
          body_html: q.body_html,
        }));
      diff = compareSurveys(
        { survey: { ...current, name: "", description: "", visibility: "all_houses", priority: 0, current_version: current.current_version } as never, questions: prevQs },
        { survey: { ...current, name: "", description: "", visibility: "all_houses", priority: 0, current_version: current.current_version } as never, questions: body.questions },
      );
      if (diff.breaking.length > 0) {
        return NextResponse.json({ error: "breaking_changes", diff }, { status: 409 });
      }
    }

    // Replace: delete and re-insert. Responses reference question_id, so for
    // active surveys we need to keep stable ids where keys match. Use upsert
    // by (survey_id, question_key).
    const existingQs: Array<{ id: string; question_key: string | null }> = (
      (
        await supabase
          .from("survey_questions")
          .select("id, question_key")
          .eq("survey_id", current.id)
      ).data ?? []
    ) as Array<{ id: string; question_key: string | null }>;
    const idByKey = new Map(
      existingQs.filter((q) => q.question_key).map((q) => [q.question_key!, q.id]),
    );
    const keptIds = new Set<string>();
    const rows = body.questions.map((q, i) => {
      const id = idByKey.get(q.question_key);
      if (id) keptIds.add(id);
      return {
        ...(id ? { id } : {}),
        survey_id: current.id,
        order_index: i + 1,
        question_text: q.question_text,
        question_type: q.question_type,
        required: q.required,
        options: q.options ?? null,
        help_text: q.help_text,
        question_key: q.question_key,
        min_value: q.min_value,
        max_value: q.max_value,
        body_html: q.question_type === "info" ? q.body_html ?? null : null,
      };
    });

    // Delete questions that are no longer in the payload.
    const toDelete = existingQs.filter((q) => !keptIds.has(q.id)).map((q) => q.id);
    if (toDelete.length > 0) {
      await supabase.from("survey_questions").delete().in("id", toDelete);
    }
    if (rows.length > 0) {
      const { error: upErr } = await supabase.from("survey_questions").upsert(rows);
      if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
    }
  }

  update.updated_at = new Date().toISOString();
  const { error } = await supabase.from("surveys").update(update).eq("id", current.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const supabase = getSupabaseServiceRoleClient();
  const { error } = await supabase
    .from("surveys")
    .update({ status: "archived", active: false })
    .eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
