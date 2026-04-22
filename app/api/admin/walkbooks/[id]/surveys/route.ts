import { NextResponse } from "next/server";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";

// GET    /api/admin/walkbooks/:id/surveys        — list currently attached
// PUT    /api/admin/walkbooks/:id/surveys {ids, pinnedId?}
//          Replace the attachment set for the walkbook. pinnedId (optional)
//          is the single survey to mark pinned=true (locks knockers to it).
// DELETE /api/admin/walkbooks/:id/surveys?surveyId=...

async function requireAdmin() {
  const s = await loadSession();
  if (!s || (s.user.role !== "admin" && s.user.role !== "super_admin")) return null;
  return s;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const supabase = getSupabaseServiceRoleClient();
  const { data } = await supabase
    .from("walkbook_surveys")
    .select("survey_id, pinned, priority, assigned_at, surveys(id, name, status, current_version)")
    .eq("walkbook_id", params.id)
    .order("priority", { ascending: false });
  return NextResponse.json({ attached: data ?? [] });
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as {
    ids?: string[];
    pinnedId?: string | null;
  };
  const ids = Array.from(new Set((body.ids ?? []).filter((s) => typeof s === "string")));
  if (body.pinnedId && !ids.includes(body.pinnedId)) {
    return NextResponse.json({ error: "pinnedId must be in ids" }, { status: 400 });
  }
  if (body.pinnedId && ids.length !== 1) {
    // Enforce the "locked" semantic: pinned only makes sense with exactly
    // one attached survey.
    return NextResponse.json(
      { error: "pinned requires exactly one attached survey" },
      { status: 400 },
    );
  }

  const supabase = getSupabaseServiceRoleClient();
  // Replace-set: wipe current, re-insert requested. Small enough to do in
  // sequence; a tiny walkbook attaches O(3) surveys at most.
  await supabase.from("walkbook_surveys").delete().eq("walkbook_id", params.id);
  if (ids.length > 0) {
    const rows = ids.map((sid) => ({
      walkbook_id: params.id,
      survey_id: sid,
      pinned: body.pinnedId === sid,
      assigned_by: session.user.id,
    }));
    const { error } = await supabase.from("walkbook_surveys").insert(rows);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, count: ids.length });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const url = new URL(req.url);
  const surveyId = url.searchParams.get("surveyId");
  if (!surveyId) return NextResponse.json({ error: "surveyId required" }, { status: 400 });
  const supabase = getSupabaseServiceRoleClient();
  const { error } = await supabase
    .from("walkbook_surveys")
    .delete()
    .eq("walkbook_id", params.id)
    .eq("survey_id", surveyId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
