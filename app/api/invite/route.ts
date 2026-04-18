import { NextResponse } from "next/server";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const session = await loadSession();
  if (!session || (session.user.role !== "admin" && session.user.role !== "super_admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { email, fullName, role, districtId, clientId } = await req.json();
  if (!email || !role) {
    return NextResponse.json({ error: "email and role required" }, { status: 400 });
  }
  if (role === "super_admin" && session.user.role !== "super_admin") {
    return NextResponse.json({ error: "only super admins can create super admins" }, { status: 403 });
  }

  const supabase = getSupabaseServiceRoleClient();
  // Prefer the configured app URL over the request origin so invites always
  // land on production even when triggered from a non-public host.
  const origin =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    req.headers.get("origin") ??
    "http://localhost:3000";
  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
    redirectTo: `${origin}/set-password`,
  });
  if (error || !data.user) {
    return NextResponse.json({ error: error?.message ?? "invite failed" }, { status: 500 });
  }

  // Scope the user to the active client + optional specific district.
  // Admins get the whole client; knockers usually get one district as a
  // default but inherit the full client_access for RLS purposes.
  const clientAccess = clientId ? [clientId] : [];
  const districtAccess = districtId ? [districtId] : [];

  await supabase
    .from("users")
    .update({
      full_name: fullName,
      role,
      default_district_id: districtId ?? null,
      district_access: districtAccess,
      client_access: clientAccess,
      active: true,
    })
    .eq("id", data.user.id);

  return NextResponse.json({ ok: true, userId: data.user.id });
}
