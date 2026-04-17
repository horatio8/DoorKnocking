import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { AppUser, District } from "@/lib/types";

export interface ActiveSession {
  user: AppUser;
  district: District | null;
}

// Loads both the auth user and our `public.users` profile row. Returns null if
// the caller isn't signed in, or if their profile is missing/inactive.
export async function loadSession(): Promise<ActiveSession | null> {
  const supabase = getSupabaseServerClient();
  const { data: authResult, error: authError } = await supabase.auth.getUser();
  if (authError || !authResult.user) return null;

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("*")
    .eq("id", authResult.user.id)
    .maybeSingle();

  if (profileError || !profile || !profile.active) return null;

  let district: District | null = null;
  if (profile.default_district_id) {
    const { data: d } = await supabase
      .from("districts")
      .select("*")
      .eq("id", profile.default_district_id)
      .maybeSingle();
    district = d as District | null;
  }

  return { user: profile as AppUser, district };
}

export async function requireSession(): Promise<ActiveSession> {
  const session = await loadSession();
  if (!session) throw new Error("unauthenticated");
  return session;
}
