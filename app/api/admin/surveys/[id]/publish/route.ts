import { NextResponse } from "next/server";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";

// POST /api/admin/surveys/:id/publish
// Validates the draft, snapshots it into survey_versions, bumps current_version,
// flips status → 'active', sets published_at.

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await loadSession();
  if (!session || (session.user.role !== "admin" && session.user.role !== "super_admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
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
  const qs = (questions ?? []) as Array<{
    id: string;
    order_index: number;
    question_text: string;
    question_type: string;
    required: boolean;
    help_text: string | null;
    options: unknown;
    question_key: string | null;
    min_value: number | null;
    max_value: number | null;
  }>;

  const problems: string[] = [];
  if (qs.length === 0) problems.push("needs at least one question");
  const seenKeys = new Set<string>();
  for (const q of qs) {
    if (!q.question_key) {
      problems.push(`"${q.question_text.slice(0, 32)}" is missing a question key`);
      continue;
    }
    if (seenKeys.has(q.question_key)) problems.push(`duplicate key "${q.question_key}"`);
    seenKeys.add(q.question_key);
    if (
      (q.question_type === "single_choice" || q.question_type === "multi_choice") &&
      (!Array.isArray(q.options) || (q.options as unknown[]).length === 0)
    ) {
      problems.push(`"${q.question_key}" needs options`);
    }
  }
  if (problems.length > 0) {
    return NextResponse.json({ error: "validation", problems }, { status: 400 });
  }

  const s = survey as {
    id: string;
    name: string;
    slug: string | null;
    description: string | null;
    visibility: string;
    priority: number;
    current_version: number;
  };
  const nextVersion = (s.current_version ?? 0) + 1;

  const snapshot = {
    name: s.name,
    slug: s.slug,
    description: s.description,
    visibility: s.visibility,
    priority: s.priority,
    questions: qs.map((q) => ({
      id: q.id,
      question_key: q.question_key,
      order_index: q.order_index,
      question_text: q.question_text,
      question_type: q.question_type,
      required: q.required,
      options: q.options,
      help_text: q.help_text,
      min_value: q.min_value,
      max_value: q.max_value,
    })),
  };

  const now = new Date().toISOString();
  const { error: verErr } = await supabase.from("survey_versions").insert({
    survey_id: s.id,
    version_number: nextVersion,
    snapshot,
    published_at: now,
    published_by: session.user.id,
  });
  if (verErr) return NextResponse.json({ error: verErr.message }, { status: 500 });

  const { error: sErr } = await supabase
    .from("surveys")
    .update({
      status: "active",
      active: true,
      current_version: nextVersion,
      published_at: now,
      published_by: session.user.id,
      updated_at: now,
    })
    .eq("id", s.id);
  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, version: nextVersion });
}
