import { NextResponse } from "next/server";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";

// Stamps users.email_verified_at after the Supabase magic-link carries the
// user back to /verify. Call is idempotent.

export async function POST() {
  const session = await loadSession();
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const supabase = getSupabaseServiceRoleClient();
  await supabase
    .from("users")
    .update({ email_verified_at: new Date().toISOString() })
    .eq("id", session.user.id)
    .is("email_verified_at", null);
  return NextResponse.json({ ok: true });
}
