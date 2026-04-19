import { NextResponse } from "next/server";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";

// POST /api/admin/surveys/:id/status { status: 'paused' | 'archived' | 'draft' }

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await loadSession();
  if (!session || (session.user.role !== "admin" && session.user.role !== "super_admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as { status?: string };
  if (!body.status || !["draft", "paused", "archived"].includes(body.status)) {
    return NextResponse.json({ error: "status must be draft|paused|archived" }, { status: 400 });
  }
  const supabase = getSupabaseServiceRoleClient();
  const { error } = await supabase
    .from("surveys")
    .update({ status: body.status, active: false, updated_at: new Date().toISOString() })
    .eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
