import { NextResponse } from "next/server";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";

// GET    /api/admin/scripts/:id              — full row for the editor
// PATCH  /api/admin/scripts/:id  { name?, body_md?, priority?, status? }
// DELETE /api/admin/scripts/:id              — archive (soft delete)

async function requireAdmin() {
  const s = await loadSession();
  if (!s || (s.user.role !== "admin" && s.user.role !== "super_admin")) return null;
  return s;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const supabase = getSupabaseServiceRoleClient();
  const { data } = await supabase.from("scripts").select("*").eq("id", params.id).maybeSingle();
  if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ script: data });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    body_md?: string;
    priority?: number;
    status?: "draft" | "active" | "paused" | "archived";
  };
  const update: Record<string, unknown> = {};
  if (body.name !== undefined) update.name = body.name.trim();
  if (body.body_md !== undefined) update.body_md = body.body_md;
  if (body.priority !== undefined) update.priority = body.priority;
  if (body.status !== undefined) {
    update.status = body.status;
    if (body.status === "active") update.published_at = new Date().toISOString();
  }
  update.updated_at = new Date().toISOString();

  const supabase = getSupabaseServiceRoleClient();
  const { error } = await supabase.from("scripts").update(update).eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const supabase = getSupabaseServiceRoleClient();
  const { error } = await supabase
    .from("scripts")
    .update({ status: "archived", updated_at: new Date().toISOString() })
    .eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
