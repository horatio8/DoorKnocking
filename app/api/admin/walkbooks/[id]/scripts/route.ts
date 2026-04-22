import { NextResponse } from "next/server";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";

// Same shape as the /surveys attachment endpoint — pinned is allowed here
// too; only relevant when an admin wants exactly one default script to
// render inline at the door.

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
    .from("walkbook_scripts")
    .select("script_id, pinned, priority, assigned_at, scripts(id, name, status)")
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

  const supabase = getSupabaseServiceRoleClient();
  await supabase.from("walkbook_scripts").delete().eq("walkbook_id", params.id);
  if (ids.length > 0) {
    const rows = ids.map((sid) => ({
      walkbook_id: params.id,
      script_id: sid,
      pinned: body.pinnedId === sid,
      assigned_by: session.user.id,
    }));
    const { error } = await supabase.from("walkbook_scripts").insert(rows);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, count: ids.length });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const url = new URL(req.url);
  const scriptId = url.searchParams.get("scriptId");
  if (!scriptId) return NextResponse.json({ error: "scriptId required" }, { status: 400 });
  const supabase = getSupabaseServiceRoleClient();
  const { error } = await supabase
    .from("walkbook_scripts")
    .delete()
    .eq("walkbook_id", params.id)
    .eq("script_id", scriptId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
