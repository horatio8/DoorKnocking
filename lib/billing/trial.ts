import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { loadSession } from "@/lib/auth/session";

// Server-side helper that resolves everything the billing-state chrome needs
// in one shot: days left on trial, subscription status, whether the user has
// a card on file. Keeps the banner logic in one place so every layout hits
// the same rules.

export interface BillingState {
  userId: string | null;
  trialEndsAt: Date | null;
  trialDaysLeft: number;
  trialEnded: boolean;
  hasPaymentMethod: boolean;
  subscriptionStatus:
    | "trialing"
    | "active"
    | "past_due"
    | "unpaid"
    | "canceled"
    | "incomplete"
    | "none";
  planName: string | null;
}

const EMPTY: BillingState = {
  userId: null,
  trialEndsAt: null,
  trialDaysLeft: 0,
  trialEnded: false,
  hasPaymentMethod: false,
  subscriptionStatus: "none",
  planName: null,
};

export async function getBillingState(): Promise<BillingState> {
  const session = await loadSession();
  if (!session) return EMPTY;
  const supabase = getSupabaseServiceRoleClient();

  const { data: userRow } = await supabase
    .from("users")
    .select("trial_started_at, trial_ends_at, stripe_customer_id")
    .eq("id", session.user.id)
    .maybeSingle();
  const u = userRow as {
    trial_started_at: string | null;
    trial_ends_at: string | null;
    stripe_customer_id: string | null;
  } | null;

  const trialEndsAt = u?.trial_ends_at ? new Date(u.trial_ends_at) : null;
  const msLeft = trialEndsAt ? trialEndsAt.getTime() - Date.now() : 0;
  const trialDaysLeft = Math.max(0, Math.ceil(msLeft / 86400000));
  const trialEnded = Boolean(trialEndsAt && trialEndsAt.getTime() <= Date.now());

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("status, plan_id")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const s = sub as { status: BillingState["subscriptionStatus"]; plan_id: string | null } | null;

  return {
    userId: session.user.id,
    trialEndsAt,
    trialDaysLeft,
    trialEnded,
    hasPaymentMethod: Boolean(u?.stripe_customer_id),
    subscriptionStatus: s?.status ?? (trialEndsAt ? "trialing" : "none"),
    planName: s?.plan_id ?? null,
  };
}
