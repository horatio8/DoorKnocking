import { cookies } from "next/headers";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { getActiveClient } from "@/lib/clients/active";
import type { AppUser } from "@/lib/types";

// Cookie that lets a tester force the /v flow on or off without flipping
// the client setting. Set via `?v=on` / `?v=off` on /app (handled by
// /api/v-flag). Lives 30 days.
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
//   2. clients.use_v_flow for the user's active client (default true).
//   3. true — the new flow is the default once the column exists.
//   4. false — only if everything errors and we genuinely can't tell.
//
// Tolerates the column not existing (pre-migration) — falls through to
// the override or the default.
export async function resolveUseVFlow(
  user: Pick<AppUser, "id" | "default_district_id" | "client_access">,
): Promise<boolean> {
  const override = readVFlowOverride();
  if (override === "on") return true;
  if (override === "off") return false;

  try {
    const clientId = await resolveClientForUser(user);
    if (!clientId) return true; // no scoping → default to new flow

    const supabase = getSupabaseServiceRoleClient();
    const { data, error } = await supabase
      .from("clients")
      .select("use_v_flow")
      .eq("id", clientId)
      .maybeSingle();
    if (error) {
      if ((error as { code?: string }).code === "42703") return true;
      console.warn("[flag.use_v_flow] client lookup failed", error);
      return true;
    }
    const value = (data as { use_v_flow?: boolean | null } | null)?.use_v_flow;
    if (value === false) return false;
    return true;
  } catch (err) {
    console.warn("[flag.use_v_flow] unexpected error", err);
    return true;
  }
}

// Find the client this user's flow should resolve against. Order:
//   1. Active client resolved by host/cookie (getActiveClient).
//   2. First entry in users.client_access.
//   3. Client that owns the user's default_district.
async function resolveClientForUser(
  user: Pick<AppUser, "id" | "default_district_id" | "client_access">,
): Promise<string | null> {
  const active = await getActiveClient();
  if (active?.id) return active.id;

  if (user.client_access && user.client_access.length > 0) {
    return user.client_access[0]!;
  }

  if (user.default_district_id) {
    const supabase = getSupabaseServiceRoleClient();
    const { data } = await supabase
      .from("districts")
      .select("client_id")
      .eq("id", user.default_district_id)
      .maybeSingle();
    const clientId = (data as { client_id?: string | null } | null)?.client_id ?? null;
    if (clientId) return clientId;
  }

  return null;
}
