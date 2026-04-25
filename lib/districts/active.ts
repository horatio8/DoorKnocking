import { cache } from "react";
import { cookies } from "next/headers";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { getActiveClient } from "@/lib/clients/active";
import { loadSession } from "@/lib/auth/session";

export interface ActiveDistrict {
  id: string;
  name: string;
  slug: string;
  client_id: string | null;
  airtable_base_id: string | null;
}

const COOKIE_NAME = "active_district_id";

// Resolves the district scoping the admin UI right now. Mirrors the
// shape of getActiveClient — cookie-driven, with role-aware fallbacks
// so a regular admin can't elevate by guessing a UUID.
//
// Returns null when:
//   - no cookie is set
//   - the cookie value is outside the caller's allowed scope
//   - the active client has been changed and the cookie now points at
//     a district that doesn't belong to it
// Callers should treat null as "show everything in current scope" —
// either all districts under the active client, or all districts the
// admin can see when no client is active.
export const getActiveDistrict = cache(async (): Promise<ActiveDistrict | null> => {
  const cookieValue = cookies().get(COOKIE_NAME)?.value;
  if (!cookieValue) return null;

  const session = await loadSession();
  if (!session) return null;

  const supabase = getSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("districts")
    .select("id, name, slug, client_id, airtable_base_id, active")
    .eq("id", cookieValue)
    .maybeSingle();
  if (error || !data) return null;
  const district = data as ActiveDistrict & { active: boolean };
  if (!district.active) return null;

  // Drop the cookie when it doesn't fit the active client — otherwise
  // a flipped client switcher would silently keep filtering by a
  // district from the previous client.
  const activeClient = await getActiveClient();
  if (activeClient && district.client_id !== activeClient.id) {
    return null;
  }

  if (session.user.role === "super_admin") return district;

  // Regular admin: must have district access or own the default.
  const access = new Set([
    ...(session.user.district_access ?? []),
    session.user.default_district_id,
  ]);
  if (!access.has(district.id)) return null;

  return district;
});

// Returns every district the caller is allowed to see in the current
// client scope. Used by the switcher dropdown and by pages that show
// all-of-scope when no active district is selected.
export async function listScopedDistricts(): Promise<ActiveDistrict[]> {
  const session = await loadSession();
  if (!session) return [];
  const supabase = getSupabaseServiceRoleClient();
  const activeClient = await getActiveClient();

  if (session.user.role === "super_admin") {
    let q = supabase
      .from("districts")
      .select("id, name, slug, client_id, airtable_base_id")
      .eq("active", true)
      .order("name");
    if (activeClient) q = q.eq("client_id", activeClient.id);
    const { data } = await q;
    return (data ?? []) as ActiveDistrict[];
  }

  const accessIds = Array.from(
    new Set(
      [
        ...(session.user.district_access ?? []),
        session.user.default_district_id,
      ].filter(Boolean) as string[],
    ),
  );
  if (accessIds.length === 0) return [];
  let q = supabase
    .from("districts")
    .select("id, name, slug, client_id, airtable_base_id")
    .in("id", accessIds)
    .eq("active", true)
    .order("name");
  if (activeClient) q = q.eq("client_id", activeClient.id);
  const { data } = await q;
  return (data ?? []) as ActiveDistrict[];
}
