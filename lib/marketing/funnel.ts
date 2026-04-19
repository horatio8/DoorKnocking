"use client";

// Client-side funnel event emitter. Fire-and-forget POST to /api/funnel/event;
// server persists to signup_funnel_events. Session id is a cookie UUID the
// server sets on first visit so anonymous events can stitch to the eventual
// user.

const SESSION_STORAGE_KEY = "cos_funnel_session";

function getSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (existing) return existing;
    const next = crypto.randomUUID();
    window.localStorage.setItem(SESSION_STORAGE_KEY, next);
    return next;
  } catch {
    return "";
  }
}

function readUtm() {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  return {
    utm_source: params.get("utm_source") ?? undefined,
    utm_medium: params.get("utm_medium") ?? undefined,
    utm_campaign: params.get("utm_campaign") ?? undefined,
  };
}

export type FunnelEvent =
  | "pricing_viewed"
  | "signup_started"
  | "signup_submitted"
  | "email_verified"
  | "wizard_step_1"
  | "wizard_step_2"
  | "wizard_step_3"
  | "wizard_complete"
  | "paywall_viewed"
  | "paywall_completed"
  | "paywall_skipped"
  | "first_voter_imported"
  | "signup_cta_clicked"
  | "pricing_cta_clicked"
  | "signin_clicked";

export function trackFunnel(event: FunnelEvent, props?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  const payload = {
    event,
    session_id: getSessionId(),
    ...readUtm(),
    props: props ?? null,
  };
  // Best-effort; beacon so it survives page transitions.
  try {
    const body = JSON.stringify(payload);
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/funnel/event", new Blob([body], { type: "application/json" }));
      return;
    }
    void fetch("/api/funnel/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    });
  } catch {
    // Don't bubble — telemetry failures must never break the user flow.
  }
}
