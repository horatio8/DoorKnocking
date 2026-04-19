import { NextResponse } from "next/server";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { loadSession } from "@/lib/auth/session";

// Anonymous funnel event sink. Writes to signup_funnel_events. If a Supabase
// session exists, we attach user_id too. Swallows all errors so telemetry
// failures never block the user flow.

const ALLOWED_EVENTS = new Set([
  "pricing_viewed",
  "signup_started",
  "signup_submitted",
  "email_verified",
  "wizard_step_1",
  "wizard_step_2",
  "wizard_step_3",
  "wizard_complete",
  "paywall_viewed",
  "paywall_completed",
  "paywall_skipped",
  "first_voter_imported",
]);

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      event?: string;
      session_id?: string;
      utm_source?: string;
      utm_medium?: string;
      utm_campaign?: string;
      props?: Record<string, unknown>;
    };
    if (!body.event || !ALLOWED_EVENTS.has(body.event)) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const session = await loadSession().catch(() => null);
    const supabase = getSupabaseServiceRoleClient();
    await supabase.from("signup_funnel_events").insert({
      event: body.event,
      session_id: body.session_id ?? null,
      user_id: session?.user.id ?? null,
      props: body.props ?? null,
      utm_source: body.utm_source ?? null,
      utm_medium: body.utm_medium ?? null,
      utm_campaign: body.utm_campaign ?? null,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("funnel: event insert failed", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
