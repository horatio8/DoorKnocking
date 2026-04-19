import { NextResponse } from "next/server";
import { getSupabaseServerClient, getSupabaseServiceRoleClient } from "@/lib/supabase/server";

// POST /api/onboarding/signup
// Body: { email, password, plan }
//
// Creates a new Supabase auth user (email-confirmation on), stamps the
// trial window + chosen plan on the public.users row, returns whether a
// verification email is required.

const TRIAL_DAYS = 14;

export async function POST(req: Request) {
  const { email, password, plan } = (await req.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
    plan?: string;
  };
  if (!email || !password || password.length < 8) {
    return NextResponse.json({ error: "email and 8+ char password required" }, { status: 400 });
  }

  const anonClient = getSupabaseServerClient();
  const origin = req.headers.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? "";
  const { data, error } = await anonClient.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: {
      emailRedirectTo: `${origin.replace(/\/$/, "")}/verify`,
    },
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const userId = data.user?.id;
  if (userId) {
    const service = getSupabaseServiceRoleClient();
    const now = new Date();
    const trialEnd = new Date(now.getTime() + TRIAL_DAYS * 86400 * 1000);
    await service
      .from("users")
      .update({
        trial_started_at: now.toISOString(),
        trial_ends_at: trialEnd.toISOString(),
        signup_plan: plan ?? "pro",
        must_change_password: false,
      })
      .eq("id", userId);
  }

  return NextResponse.json({
    ok: true,
    requires_verification: !data.session,
    email,
  });
}
