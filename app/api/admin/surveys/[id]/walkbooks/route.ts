import { NextResponse } from "next/server";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";

// Inverse of /api/admin/walkbooks/[id]/surveys — attaches THIS survey
// to the given list of walkbooks. Replace-set semantics: walkbooks not
// in `ids` get the row removed; walkbooks already attached keep their
// pinned/priority metadata so we don't trash a per-walkbook lock just
// because the survey was re-saved.
//
// Body: { ids: string[] }   // walkbook ids in the survey's district

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
    .select("walkbook_id, pinned, priority, assigned_at")
    .eq("survey_id", params.id);
  return NextResponse.json({ attached: data ?? [] });
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { ids?: string[] };
  const requested = Array.from(
    new Set((body.ids ?? []).filter((s) => typeof s === "string")),
  );

  const supabase = getSupabaseServiceRoleClient();

  // Confirm the survey exists + lock the operation to its own district —
  // every walkbook in `requested` must share that district id.
  const { data: surveyRow } = await supabase
    .from("surveys")
    .select("id, district_id")
    .eq("id", params.id)
    .maybeSingle();
  const survey = surveyRow as { id: string; district_id: string } | null;
  if (!survey) return NextResponse.json({ error: "survey not found" }, { status: 404 });

  if (requested.length > 0) {
    const { data: wbRows } = await supabase
      .from("walkbooks")
      .select("id, district_id")
      .in("id", requested);
    const fetched = (wbRows ?? []) as Array<{ id: string; district_id: string }>;
    const wrongDistrict = fetched.filter((w) => w.district_id !== survey.district_id);
    if (wrongDistrict.length > 0) {
      return NextResponse.json(
        { error: "walkbook(s) not in this survey's district" },
        { status: 400 },
      );
    }
    if (fetched.length !== requested.length) {
      return NextResponse.json({ error: "one or more walkbooks not found" }, { status: 404 });
    }
  }

  // Diff against the current attachments so existing rows (with their
  // pinned + priority metadata) survive an unrelated re-save.
  const { data: currentRows } = await supabase
    .from("walkbook_surveys")
    .select("walkbook_id")
    .eq("survey_id", params.id);
  const current = new Set(
    ((currentRows ?? []) as Array<{ walkbook_id: string }>).map((r) => r.walkbook_id),
  );
  const next = new Set(requested);

  const toAdd = [...next].filter((wbId) => !current.has(wbId));
  const toRemove = [...current].filter((wbId) => !next.has(wbId));

  if (toRemove.length > 0) {
    const { error: delErr } = await supabase
      .from("walkbook_surveys")
      .delete()
      .eq("survey_id", params.id)
      .in("walkbook_id", toRemove);
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });
  }
  if (toAdd.length > 0) {
    const rows = toAdd.map((wbId) => ({
      walkbook_id: wbId,
      survey_id: params.id,
      assigned_by: session.user.id,
    }));
    const { error: insErr } = await supabase.from("walkbook_surveys").insert(rows);
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    attached: requested.length,
    added: toAdd.length,
    removed: toRemove.length,
  });
}
