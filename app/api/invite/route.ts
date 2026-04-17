import { NextResponse } from "next/server";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const session = await loadSession();
  if (!session || (session.user.role !== "admin" && session.user.role !== "super_admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { email, fullName, role, districtId } = await req.json();
  if (!email || !role) {
    return NextResponse.json({ error: "email and role required" }, { status: 400 });
  }
  if (role === "super_admin" && session.user.role !== "super_admin") {
    return NextResponse.json({ error: "only super admins can create super admins" }, { status: 403 });
  }

  const supabase = getSupabaseServiceRoleClient();
  const origin = req.headers.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
    redirectTo: `${origin}/login`,
  });
  if (error || !data.user) {
    return NextResponse.json({ error: error?.message ?? "invite failed" }, { status: 500 });
  }

  await supabase
    .from("users")
    .update({
      full_name: fullName,
      role,
      default_district_id: districtId ?? null,
      district_access: districtId ? [districtId] : [],
      active: true,
    })
    .eq("id", data.user.id);

  return NextResponse.json({ ok: true, userId: data.user.id });
}
