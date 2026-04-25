// Inline mirror + stamp wrapper. API endpoints that touch knock_events
// call this right after their write so the Airtable Knocks row is
// updated within the same request — instead of waiting up to 2 min
// for the next /api/cron/mirror-airtable tick.
//
// Failures are swallowed: a knock save in Supabase must never depend
// on Airtable being up. The cron remains the catch-up path for
// anything that fails inline (the row stays at airtable_synced_at IS
// NULL, which is what the cron's pending query looks for).

import type { SupabaseClient } from "@supabase/supabase-js";
import { mirrorKnockToAirtable, type MirrorKnockOutcome } from "./mirror-knock";

export async function syncKnockNow(
  supabase: SupabaseClient,
  knockEventId: string,
): Promise<MirrorKnockOutcome> {
  let outcome: MirrorKnockOutcome;
  try {
    outcome = await mirrorKnockToAirtable({ supabase, knockEventId });
  } catch (err) {
    console.warn("[sync-knock-now] mirror threw — cron will retry", {
      knockEventId,
      message: (err as Error).message,
    });
    return {
      status: "error",
      knockEventId,
      reason: (err as Error).message,
    };
  }

  if (outcome.status === "ok") {
    // Stamp synced_at AND airtable_knock_rec_id so the next inline
    // call (or cron tick) PATCHes the existing Airtable row instead
    // of creating a duplicate. The Postgres reset trigger
    // (knock_events_reset_airtable_sync_trg) clears synced_at on
    // relevant column changes, which is what re-arms the cron.
    const { error } = await supabase
      .from("knock_events")
      .update({
        airtable_synced_at: new Date().toISOString(),
        airtable_knock_rec_id: outcome.airtableRecId,
      })
      .eq("id", knockEventId);
    if (error) {
      console.warn("[sync-knock-now] stamp failed (mirror succeeded)", {
        knockEventId,
        message: error.message,
      });
    }
  } else if (outcome.status === "skipped") {
    // Stamp so the cron stops re-trying a row it can never mirror
    // (no canonical base, no token, voter without airtable_voter_key).
    await supabase
      .from("knock_events")
      .update({ airtable_synced_at: new Date().toISOString() })
      .eq("id", knockEventId);
  }
  // status === "error" → leave airtable_synced_at null so the cron
  // picks it up on the next tick.

  return outcome;
}
