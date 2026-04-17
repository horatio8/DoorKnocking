import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { AppUser, District } from "@/lib/types";

export interface ActiveSession {
  user: AppUser;
  district: District | null;
}

// Loads both the auth user and our `public.users` profile row. Returns null if
// the caller isn't signed in, or if their profile is missing/inactive. Logs
// anything unexpected to the Vercel runtime logs instead of crashing.
export async function loadSession(): Promise<ActiveSession | null> {
  try {
    const supabase = getSupabaseServerClient();
    const { data: authResult, error: authError } = await supabase.auth.getUser();
    if (authError || !authResult.user) return null;

    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("*")
      .eq("id", authResult.user.id)
      .maybeSingle();

    if (profileError) {
      console.error("loadSession: profile lookup failed", profileError);
      return null;
    }
    if (!profile || !profile.active) return null;

    let district: District | null = null;
    if (profile.default_district_id) {
      const { data: d, error: districtError } = await supabase
        .from("districts")
        .select("*")
        .eq("id", profile.default_district_id)
        .maybeSingle();
      if (districtError) {
        console.error("loadSession: district lookup failed", districtError);
      }
      district = (d as District | null) ?? null;
    }

    return { user: profile as AppUser, district };
  } catch (err) {
    console.error("loadSession: unexpected error", err);
    return null;
  }
}

export async function requireSession(): Promise<ActiveSession> {
  const session = await loadSession();
  if (!session) throw new Error("unauthenticated");
  return session;
}
