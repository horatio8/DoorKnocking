import { NextResponse } from "next/server";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";

const COOKIE_NAME = "active_client_id";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

// POST { clientId } — set the active client context cookie.
// Honoured by getActiveClient() as a fallback when no client subdomain is
// present (super-admin working from the apex, or admin with access to
// multiple clients). Access is validated server-side against client_access
// / super_admin role so a stolen cookie can't elevate privilege.
export async function POST(req: Request) {
  const session = await loadSession();
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { clientId?: string };
  const clientId = body.clientId;
  if (!clientId) return NextResponse.json({ error: "clientId required" }, { status: 400 });

  if (session.user.role !== "super_admin") {
    const supabase = getSupabaseServiceRoleClient();
    const { data: user } = await supabase
      .from("users")
      .select("client_access")
      .eq("id", session.user.id)
      .maybeSingle();
    const access = ((user?.client_access as string[] | undefined) ?? []).map((x) => String(x));
    if (!access.includes(clientId)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, clientId, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(COOKIE_NAME);
  return res;
}
