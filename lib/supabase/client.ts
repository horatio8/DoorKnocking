"use client";

import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";

let singleton: ReturnType<typeof createBrowserClient> | null = null;

export function getSupabaseBrowserClient() {
  if (!singleton) {
    singleton = createBrowserClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      realtime: { params: { eventsPerSecond: 10 } },
    });
  }
  return singleton;
}
