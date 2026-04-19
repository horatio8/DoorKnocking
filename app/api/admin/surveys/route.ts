import { NextResponse } from "next/server";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { toSlug, ensureUniqueSlug } from "@/lib/surveys/slug";
import { SURVEY_TEMPLATES } from "@/lib/surveys/templates";
import type { SurveyQuestionDraft } from "@/lib/surveys/types";

// POST /api/admin/surveys
// Body: { districtId, name, description?, visibility?, priority?, templateKey? }
// Creates a new draft survey (optionally seeded from a template).

export async function POST(req: Request) {
  const session = await loadSession();
  if (!session || (session.user.role !== "admin" && session.user.role !== "super_admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    districtId?: string;
    name?: string;
    description?: string;
    visibility?: "all_houses" | "assigned_only";
    priority?: number;
    templateKey?: string;
  };

  const districtId = body.districtId ?? session.district?.id;
  if (!districtId) return NextResponse.json({ error: "districtId required" }, { status: 400 });
  if (!body.name || !body.name.trim()) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }

  const supabase = getSupabaseServiceRoleClient();

  // Unique slug per district.
  const { data: existingSlugs } = await supabase
    .from("surveys")
    .select("slug")
    .eq("district_id", districtId);
  const taken = ((existingSlugs ?? []) as Array<{ slug: string | null }>)
    .map((r) => r.slug)
    .filter((s): s is string => Boolean(s));
  const slug = ensureUniqueSlug(toSlug(body.name), taken);

  const { data: survey, error } = await supabase
    .from("surveys")
    .insert({
      district_id: districtId,
      name: body.name.trim(),
      slug,
      description: body.description ?? null,
      visibility: body.visibility ?? "all_houses",
      priority: body.priority ?? 0,
      status: "draft",
      active: false,
      created_by: session.user.id,
    })
    .select("*")
    .single();
  if (error || !survey) {
    return NextResponse.json({ error: error?.message ?? "create failed" }, { status: 500 });
  }

  // Seed from template if requested.
  const template = SURVEY_TEMPLATES.find((t) => t.key === body.templateKey);
  if (template) {
    const rows = template.questions.map((q, i) => ({
      survey_id: survey.id as string,
      order_index: i + 1,
      question_text: q.question_text,
      question_type: q.question_type,
      required: q.required,
      options: q.options ?? null,
      help_text: q.help_text,
      question_key: q.question_key,
      min_value: q.min_value,
      max_value: q.max_value,
    }));
    if (rows.length > 0) {
      const { error: qErr } = await supabase.from("survey_questions").insert(rows);
      if (qErr) return NextResponse.json({ error: `seed: ${qErr.message}` }, { status: 500 });
    }
  }

  return NextResponse.json({ id: survey.id as string, slug });
}

export async function GET(req: Request) {
  const session = await loadSession();
  if (!session || (session.user.role !== "admin" && session.user.role !== "super_admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const url = new URL(req.url);
  const districtId = url.searchParams.get("districtId") ?? session.district?.id;
  if (!districtId) return NextResponse.json({ surveys: [] });

  const supabase = getSupabaseServiceRoleClient();
  const { data } = await supabase
    .from("surveys")
    .select(
      "id, name, slug, description, visibility, priority, status, current_version, published_at, updated_at, created_at",
    )
    .eq("district_id", districtId)
    .order("priority", { ascending: false })
    .order("updated_at", { ascending: false });

  return NextResponse.json({ surveys: data ?? [] });
}

// For reference elsewhere.
export type { SurveyQuestionDraft };
