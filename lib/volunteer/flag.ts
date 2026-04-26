import { cookies } from "next/headers";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";

// Cookie that lets a tester force the /v flow on or off without an admin
// flipping the DB column. Set via the `?v=on` / `?v=off` query param on
// /app (see app/(knocker)/app/page.tsx). Lives 30 days.
export const V_FLOW_COOKIE = "v_flow";

export type VFlowOverride = "on" | "off" | null;

export function readVFlowOverride(): VFlowOverride {
  const value = cookies().get(V_FLOW_COOKIE)?.value;
  if (value === "on" || value === "off") return value;
  return null;
}

// Resolves whether a given signed-in user should be sent into the new
// `/v` flow. Order of precedence:
//   1. Cookie override (set by ?v=on / ?v=off on /app).
//   2. users.use_v_flow column (set by an admin or the user themselves).
//   3. Default false — old /app/* flow stays the canonical experience
//      until the cutover.
//
// Tolerates the column not existing (pre-migration env) — falls back to
// the override or false. Any unexpected error is logged and treated as
// "not on the new flow" so a stale DB never strands a knocker.
export async function resolveUseVFlow(userId: string): Promise<boolean> {
  const override = readVFlowOverride();
  if (override === "on") return true;
  if (override === "off") return false;

  try {
    const supabase = getSupabaseServiceRoleClient();
    const { data, error } = await supabase
      .from("users")
      .select("use_v_flow")
      .eq("id", userId)
      .maybeSingle();
    if (error) {
      // 42703 = undefined column. The migration hasn't shipped on this DB
      // yet; treat as "feature not yet rolled out".
      if ((error as { code?: string }).code === "42703") return false;
      console.warn("[flag.use_v_flow] lookup failed", error);
      return false;
    }
    return Boolean((data as { use_v_flow?: boolean } | null)?.use_v_flow);
  } catch (err) {
    console.warn("[flag.use_v_flow] unexpected error", err);
    return false;
  }
}
