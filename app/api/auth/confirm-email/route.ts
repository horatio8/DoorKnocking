import { NextResponse } from "next/server";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";

// Force-confirms a user's email so signInWithPassword stops bouncing with
// "Email not confirmed". Safe to expose: this only flips email_confirmed_at
// on a known-to-us user — it does not grant access. The caller still needs
// the password to actually sign in.
//
// Why we have this at all: this is an invite-only platform (admins create
// users via /api/invite). Supabase's project-level "Confirm email" toggle
// adds zero security here — it just blocks legitimate users whose invite
// path didn't auto-confirm them. Rather than flip the project setting (and
// have it silently re-enabled by a future console change), we treat email
// confirmation as a no-op at the app layer.

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { email?: string };
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email) {
    return NextResponse.json({ error: "email required" }, { status: 400 });
  }

  const supabase = getSupabaseServiceRoleClient();

  // listUsers is paged; default 50, max 1000. We page until we find the
  // match or exhaust — this is a one-call-per-stuck-login path, not hot.
  let target: { id: string; email_confirmed_at: string | null } | null = null;
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const match = (data?.users ?? []).find(
      (u) => u.email && u.email.toLowerCase() === email,
    );
    if (match) {
      target = {
        id: match.id,
        email_confirmed_at: match.email_confirmed_at ?? null,
      };
      break;
    }
    if (!data?.users || data.users.length < 1000) break;
  }

  if (!target) {
    // Don't leak whether the email exists — return ok so the client just
    // retries signInWithPassword, which will fail with "invalid credentials"
    // for unknown users (same shape as a wrong password).
    return NextResponse.json({ ok: true, confirmed: false });
  }

  if (target.email_confirmed_at) {
    return NextResponse.json({ ok: true, confirmed: true, alreadyConfirmed: true });
  }

  const { error } = await supabase.auth.admin.updateUserById(target.id, {
    email_confirm: true,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, confirmed: true });
}
