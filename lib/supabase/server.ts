import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { anonEnv, serviceRoleEnv } from "@/lib/env";

export function getSupabaseServerClient() {
  const env = anonEnv();
  const cookieStore = cookies();
  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set({ name, value, ...(options as object) });
          }
        } catch {
          // Called from a server component — Next forbids writes here; safe to ignore.
        }
      },
    },
  });
}

// For Edge Functions / scripts / n8n callbacks — elevated access.
export function getSupabaseServiceRoleClient() {
  const env = serviceRoleEnv();
  return createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
