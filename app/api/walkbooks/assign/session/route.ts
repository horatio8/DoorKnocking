import { NextResponse } from "next/server";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";

// Session lock for /admin/walkbooks/assign. One admin per district at a time.
//
// POST   /api/walkbooks/assign/session { districtId }        — claim or extend
// DELETE /api/walkbooks/assign/session?districtId=…          — release
// GET    /api/walkbooks/assign/session?districtId=…          — who holds it?
//
// The lock TTL is 15min from last heartbeat. Admin B trying to claim while A
// holds gets 409 with { heldBy, heldUntil } so the UI can show a "take over"
// prompt. Take-over is just a POST with force=true.

const TTL_MINUTES = 15;

async function auth() {
  const session = await loadSession();
  if (!session) return { error: "forbidden" as const };
  if (session.user.role !== "admin" && session.user.role !== "super_admin") {
    return { error: "forbidden" as const };
  }
  return { session };
}

export async function GET(req: Request) {
  const ctx = await auth();
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: 403 });
  const url = new URL(req.url);
  const districtId = url.searchParams.get("districtId");
  if (!districtId) return NextResponse.json({ error: "districtId required" }, { status: 400 });

  const supabase = getSupabaseServiceRoleClient();
  const { data } = await supabase
    .from("assignment_sessions")
    .select("held_by, held_until, users:users!assignment_sessions_held_by_fkey(full_name)")
    .eq("district_id", districtId)
    .maybeSingle();

  if (!data) return NextResponse.json({ heldBy: null });
  const heldUntil = new Date(data.held_until as string).getTime();
  if (heldUntil < Date.now()) return NextResponse.json({ heldBy: null, expired: true });
  const u = Array.isArray(data.users) ? data.users[0] : data.users;
  return NextResponse.json({
    heldBy: data.held_by,
    heldByName: (u as { full_name?: string } | null)?.full_name ?? null,
    heldUntil: data.held_until,
    isMe: data.held_by === ctx.session.user.id,
  });
}

export async function POST(req: Request) {
  const ctx = await auth();
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as {
    districtId?: string;
    force?: boolean;
  };
  const districtId = body.districtId;
  if (!districtId) return NextResponse.json({ error: "districtId required" }, { status: 400 });

  const supabase = getSupabaseServiceRoleClient();
  const { data: current } = await supabase
    .from("assignment_sessions")
    .select("held_by, held_until")
    .eq("district_id", districtId)
    .maybeSingle();

  const now = new Date();
  const expiresAt = new Date(now.getTime() + TTL_MINUTES * 60_000);

  if (current) {
    const heldUntil = new Date(current.held_until as string).getTime();
    const stillValid = heldUntil > now.getTime();
    const isMine = current.held_by === ctx.session.user.id;
    if (stillValid && !isMine && !body.force) {
      return NextResponse.json(
        {
          error: "locked",
          heldBy: current.held_by,
          heldUntil: current.held_until,
        },
        { status: 409 },
      );
    }
  }

  const { error } = await supabase
    .from("assignment_sessions")
    .upsert(
      {
        district_id: districtId,
        held_by: ctx.session.user.id,
        held_at: current ? (current.held_by === ctx.session.user.id ? undefined : now.toISOString()) : now.toISOString(),
        held_until: expiresAt.toISOString(),
      },
      { onConflict: "district_id" },
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, heldUntil: expiresAt.toISOString() });
}

export async function DELETE(req: Request) {
  const ctx = await auth();
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: 403 });
  const url = new URL(req.url);
  const districtId = url.searchParams.get("districtId");
  if (!districtId) return NextResponse.json({ error: "districtId required" }, { status: 400 });

  const supabase = getSupabaseServiceRoleClient();
  await supabase
    .from("assignment_sessions")
    .delete()
    .eq("district_id", districtId)
    .eq("held_by", ctx.session.user.id);
  return NextResponse.json({ ok: true });
}
