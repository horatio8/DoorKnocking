import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { serverEnv } from "@/lib/env";

export function getSupabaseServerClient() {
  const env = serverEnv();
  const cookieStore = cookies();
  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      get(name) {
        return cookieStore.get(name)?.value;
      },
      set(name, value, options) {
        try {
          cookieStore.set({ name, value, ...options });
        } catch {
          // Called from a server component — Next forbids writes here; safe to ignore.
        }
      },
      remove(name, options) {
        try {
          cookieStore.set({ name, value: "", ...options });
        } catch {
          // See above.
        }
      },
    },
  });
}

// For Edge Functions / scripts / n8n callbacks — elevated access.
export function getSupabaseServiceRoleClient() {
  const env = serverEnv();
  const { createClient } = require("@supabase/supabase-js");
  return createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
