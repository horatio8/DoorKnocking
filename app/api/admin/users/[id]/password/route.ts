import { NextResponse } from "next/server";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";

// POST /api/admin/users/[id]/password
//
// Two admin-driven password actions on a single endpoint:
//   { action: "send_reset_email" }
//     → Sends a Supabase recovery email to the user. Lands them on
//       /set-password with a recovery session, where set-password-form
//       writes the new password through supabase.auth.updateUser.
//   { action: "set_password", password: "..." }
//     → Sets the password directly via auth.admin.updateUserById.
//       Useful for in-person resets (kiosks, phone calls) when an
//       email round-trip isn't available. Also flips
//       must_change_password=true on the public.users row so the
//       user is forced through /set-password on next login to pick
//       their own.
//
// Admin-gated; super_admin can target anyone, plain admin can target
// any user in their client_access scope. Targets that are themselves
// super_admin can only be reset by another super_admin.

const PASSWORD_MIN = 8;

interface SendResetBody {
  action: "send_reset_email";
}
interface SetPasswordBody {
  action: "set_password";
  password: string;
}
type Body = SendResetBody | SetPasswordBody;

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await loadSession();
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (session.user.role !== "admin" && session.user.role !== "super_admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const supabase = getSupabaseServiceRoleClient();
  const { data: target } = await supabase
    .from("users")
    .select("id, email, role, client_access")
    .eq("id", params.id)
    .maybeSingle();
  if (!target) return NextResponse.json({ error: "user not found" }, { status: 404 });
  const t = target as {
    id: string;
    email: string;
    role: string;
    client_access: string[] | null;
  };

  // Tier check: a plain admin can't reset a super_admin.
  if (t.role === "super_admin" && session.user.role !== "super_admin") {
    return NextResponse.json(
      { error: "only super_admins can reset another super_admin's password" },
      { status: 403 },
    );
  }
  // Plain admin: target must share a client with caller. Super_admin
  // skips this check.
  if (session.user.role !== "super_admin") {
    const callerClients = new Set(session.user.client_access ?? []);
    const targetClients = (t.client_access ?? []) as string[];
    const overlap = targetClients.some((c) => callerClients.has(c));
    if (!overlap) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  }

  const body = (await req.json().catch(() => ({}))) as Partial<Body>;

  if (body.action === "send_reset_email") {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";
    const redirectTo = appUrl ? `${appUrl}/set-password` : undefined;
    const { error } = await supabase.auth.resetPasswordForEmail(t.email, {
      redirectTo,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, sent_to: t.email });
  }

  if (body.action === "set_password") {
    const password = (body as SetPasswordBody).password ?? "";
    if (typeof password !== "string" || password.length < PASSWORD_MIN) {
      return NextResponse.json(
        { error: `password must be at least ${PASSWORD_MIN} characters` },
        { status: 400 },
      );
    }
    const { error } = await supabase.auth.admin.updateUserById(t.id, {
      password,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Flip must_change_password so the user picks their own on next
    // login — admin-issued passwords should be a one-time bridge.
    await supabase
      .from("users")
      .update({ must_change_password: true })
      .eq("id", t.id);

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json(
    { error: "action must be 'send_reset_email' or 'set_password'" },
    { status: 400 },
  );
}
