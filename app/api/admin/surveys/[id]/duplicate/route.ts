import { NextResponse } from "next/server";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { toSlug, ensureUniqueSlug } from "@/lib/surveys/slug";

// POST /api/admin/surveys/:id/duplicate — copy metadata + questions into a new draft.

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await loadSession();
  if (!session || (session.user.role !== "admin" && session.user.role !== "super_admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const supabase = getSupabaseServiceRoleClient();

  const { data: src } = await supabase
    .from("surveys")
    .select("name, description, district_id, visibility, priority")
    .eq("id", params.id)
    .maybeSingle();
  if (!src) return NextResponse.json({ error: "not found" }, { status: 404 });
  const s = src as {
    name: string;
    description: string | null;
    district_id: string;
    visibility: string;
    priority: number;
  };

  const { data: slugRows } = await supabase
    .from("surveys")
    .select("slug")
    .eq("district_id", s.district_id);
  const taken = ((slugRows ?? []) as Array<{ slug: string | null }>)
    .map((r) => r.slug)
    .filter((v): v is string => Boolean(v));
  const dupName = `${s.name} (copy)`;
  const slug = ensureUniqueSlug(toSlug(dupName), taken);

  const { data: inserted, error: insErr } = await supabase
    .from("surveys")
    .insert({
      name: dupName,
      description: s.description,
      district_id: s.district_id,
      visibility: s.visibility,
      priority: s.priority,
      slug,
      status: "draft",
      active: false,
      created_by: session.user.id,
    })
    .select("id")
    .single();
  if (insErr || !inserted) {
    return NextResponse.json({ error: insErr?.message ?? "dup failed" }, { status: 500 });
  }

  const { data: qs } = await supabase
    .from("survey_questions")
    .select("order_index, question_text, question_type, required, options, help_text, question_key, min_value, max_value")
    .eq("survey_id", params.id)
    .order("order_index");
  const rows = ((qs ?? []) as Array<Record<string, unknown>>).map((q) => ({
    ...q,
    survey_id: inserted.id as string,
  }));
  if (rows.length > 0) {
    const { error: qErr } = await supabase.from("survey_questions").insert(rows);
    if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 });
  }

  return NextResponse.json({ id: inserted.id as string });
}
