import { NextResponse } from "next/server";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";

const COOKIE_NAME = "active_district_id";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

// POST { districtId } — set the active district context cookie. Used by
// the DistrictSwitcher in the admin header. Mirrors active-client.
//
// Validation is server-side: super_admin can pin any active district,
// regular admins must have it in district_access[] or as their default.
// Cleared via DELETE (also returned when "all" is selected in the UI,
// so the switcher can express "no scoping").
export async function POST(req: Request) {
  const session = await loadSession();
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { districtId?: string | null };
  const districtId = body.districtId;
  if (!districtId) {
    // Treat empty/null as a clear instead of a 400 so the switcher can
    // wire its "All" option to a single endpoint.
    const res = NextResponse.json({ ok: true });
    res.cookies.delete(COOKIE_NAME);
    return res;
  }

  const supabase = getSupabaseServiceRoleClient();
  const { data: district } = await supabase
    .from("districts")
    .select("id, client_id, active")
    .eq("id", districtId)
    .maybeSingle();
  const d = district as { id: string; client_id: string | null; active: boolean } | null;
  if (!d || !d.active) {
    return NextResponse.json({ error: "district not found" }, { status: 404 });
  }

  if (session.user.role !== "super_admin") {
    const access = new Set([
      ...(session.user.district_access ?? []),
      session.user.default_district_id,
    ]);
    if (!access.has(d.id)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, districtId, {
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
