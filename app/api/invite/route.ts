import { NextResponse } from "next/server";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const session = await loadSession();
  if (!session || (session.user.role !== "admin" && session.user.role !== "super_admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { email, fullName, role, districtId, clientId } = await req.json();
  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!normalizedEmail || !role) {
    return NextResponse.json({ error: "email and role required" }, { status: 400 });
  }
  if (role === "super_admin" && session.user.role !== "super_admin") {
    return NextResponse.json({ error: "only super admins can create super admins" }, { status: 403 });
  }

  const supabase = getSupabaseServiceRoleClient();

  // Check if this email already has an auth user. If so, just extend their
  // access arrays (users belong to 1..many clients/districts).
  const { data: authList } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const existing = (authList?.users ?? []).find(
    (u) => u.email && u.email.toLowerCase() === normalizedEmail,
  );

  if (existing) {
    const { data: existingRow } = await supabase
      .from("users")
      .select("client_access, district_access, default_district_id")
      .eq("id", existing.id)
      .maybeSingle();
    const clientAccess = new Set(((existingRow?.client_access as string[] | null) ?? []));
    if (clientId) clientAccess.add(clientId);
    const districtAccess = new Set(((existingRow?.district_access as string[] | null) ?? []));
    if (districtId) districtAccess.add(districtId);

    await supabase
      .from("users")
      .update({
        client_access: Array.from(clientAccess),
        district_access: Array.from(districtAccess),
        // Don't overwrite an existing default_district — first-client wins.
        default_district_id: existingRow?.default_district_id ?? districtId ?? null,
      })
      .eq("id", existing.id);

    return NextResponse.json({
      ok: true,
      userId: existing.id,
      status: "linked",
      message: "User already exists — added to this client/district instead of re-inviting.",
    });
  }

  // New user — send the invite email.
  const origin =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    req.headers.get("origin") ??
    "http://localhost:3000";
  const { data, error } = await supabase.auth.admin.inviteUserByEmail(normalizedEmail, {
    data: { full_name: fullName },
    redirectTo: `${origin}/set-password`,
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
      client_access: clientId ? [clientId] : [],
      active: true,
    })
    .eq("id", data.user.id);

  return NextResponse.json({ ok: true, userId: data.user.id, status: "invited" });
}
