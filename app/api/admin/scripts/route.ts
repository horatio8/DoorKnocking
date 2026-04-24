import { NextResponse } from "next/server";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";

// GET  /api/admin/scripts?districtId=
// POST /api/admin/scripts  { districtId, name, body_md?, priority? }
//
// Scripts are district-scoped talking-points / door intros the knocker can
// pull up at the door. Very thin CRUD — status is 'draft' until an admin
// publishes. Publish flips status='active' and stamps published_at.

export async function GET(req: Request) {
  const session = await loadSession();
  if (!session || (session.user.role !== "admin" && session.user.role !== "super_admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const url = new URL(req.url);
  const districtId = url.searchParams.get("districtId") ?? session.district?.id;
  if (!districtId) return NextResponse.json({ scripts: [] });
  const supabase = getSupabaseServiceRoleClient();
  const { data } = await supabase
    .from("scripts")
    .select("id, name, status, priority, updated_at, published_at")
    .eq("district_id", districtId)
    .order("status", { ascending: true })
    .order("priority", { ascending: false })
    .order("updated_at", { ascending: false });
  return NextResponse.json({ scripts: data ?? [] });
}

export async function POST(req: Request) {
  const session = await loadSession();
  if (!session || (session.user.role !== "admin" && session.user.role !== "super_admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    districtId?: string;
    name?: string;
    body_md?: string;
    priority?: number;
  };
  const districtId = body.districtId ?? session.district?.id;
  if (!districtId) return NextResponse.json({ error: "districtId required" }, { status: 400 });
  if (!body.name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });

  const supabase = getSupabaseServiceRoleClient();
  const { data: row, error } = await supabase
    .from("scripts")
    .insert({
      district_id: districtId,
      name: body.name.trim(),
      body_md: body.body_md ?? "",
      priority: body.priority ?? 0,
      status: "draft",
      created_by: session.user.id,
    })
    .select("id")
    .single();
  if (error || !row) {
    return NextResponse.json({ error: error?.message ?? "create failed" }, { status: 500 });
  }
  return NextResponse.json({ id: row.id as string });
}
