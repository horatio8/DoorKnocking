"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  deleteOutbox,
  markOutboxAttempt,
  pendingOutbox,
  type OutboxEntry,
} from "./db";

const MAX_ATTEMPTS = 10;

const TABLE_BY_ENDPOINT: Record<OutboxEntry["endpoint"], string> = {
  knock_event: "knock_events",
  tag: "tags",
  voter_tag: "voter_tags",
  survey_response: "survey_responses",
  voter_note: "voter_notes",
};

export async function flushOutbox(): Promise<{ flushed: number; failed: number }> {
  if (typeof window === "undefined") return { flushed: 0, failed: 0 };
  if (!navigator.onLine) return { flushed: 0, failed: 0 };

  const supabase = getSupabaseBrowserClient();
  const entries = await pendingOutbox();
  let flushed = 0;
  let failed = 0;

  for (const entry of entries) {
    if (entry.attempts >= MAX_ATTEMPTS) continue;
    const table = TABLE_BY_ENDPOINT[entry.endpoint];
    try {
      const { error } = await supabase
        .from(table)
        .upsert(entry.payload, {
          onConflict: entry.endpoint === "knock_event" ? "client_event_id" : undefined,
        });
      if (error) throw error;
      await deleteOutbox(entry.id);
      flushed++;
    } catch (err) {
      failed++;
      await markOutboxAttempt(entry, (err as Error).message);
    }
  }
  return { flushed, failed };
}

let interval: ReturnType<typeof setInterval> | null = null;

export function startSyncWorker() {
  if (typeof window === "undefined" || interval) return;
  const kick = () => {
    flushOutbox().catch(() => void 0);
  };
  interval = setInterval(kick, 30_000);
  window.addEventListener("online", kick);
  kick();
}

export function stopSyncWorker() {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}
