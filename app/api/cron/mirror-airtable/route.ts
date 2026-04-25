import { NextResponse } from "next/server";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { mirrorKnockToAirtable } from "@/lib/airtable/mirror-knock";

// Cron-driven mirror of unsynced knock_events into the canonical
// Airtable Knocks table. Runs every 2 minutes (vercel.json), drains
// up to BATCH_SIZE rows per tick, stamps airtable_synced_at after
// each row regardless of outcome (skipped rows would otherwise
// re-queue every tick and burn API calls).
//
// Three ways in (matching /api/cron/import-worker):
//   1. Vercel cron (x-vercel-cron header)
//   2. CRON_SECRET bearer
//   3. Authenticated admin session — useful for manual nudges from
//      /admin/system/jobs.

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const BATCH_SIZE = 100;

async function authorize(req: Request): Promise<boolean> {
  if (req.headers.get("x-vercel-cron") === "1") return true;
  const ua = req.headers.get("user-agent") ?? "";
  if (/^vercel-cron/i.test(ua)) return true;
  const expected = process.env.CRON_SECRET;
  if (expected && req.headers.get("authorization") === `Bearer ${expected}`) return true;
  const session = await loadSession();
  if (session?.user.role === "admin" || session?.user.role === "super_admin") return true;
  return false;
}

export async function GET(req: Request) {
  if (!(await authorize(req))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const supabase = getSupabaseServiceRoleClient();
  const startedAt = Date.now();

  // Pull the oldest unsynced rows. Order by knocked_at so the
  // mirror writes them to Airtable in roughly chronological order
  // — keeps the Voters table's "Last *" denormalisation correct
  // even if a backlog clears in one big sweep.
  const { data: pendingRows, error: pendingErr } = await supabase
    .from("knock_events")
    .select("id")
    .is("airtable_synced_at", null)
    .order("knocked_at", { ascending: true })
    .limit(BATCH_SIZE);
  if (pendingErr) {
    console.error("[mirror-airtable] pending lookup failed", pendingErr.message);
    return NextResponse.json({ error: pendingErr.message }, { status: 500 });
  }
  const pending = (pendingRows ?? []) as Array<{ id: string }>;
  if (pending.length === 0) {
    return NextResponse.json({ ok: true, picked: 0, mirrored: 0, skipped: 0 });
  }

  const counters = { mirrored: 0, skipped: 0, errored: 0 };
  const errors: Array<{ id: string; reason: string }> = [];

  for (const row of pending) {
    try {
      const outcome = await mirrorKnockToAirtable({
        supabase,
        knockEventId: row.id,
      });
      if (outcome.status === "ok") {
        counters.mirrored++;
        await stampSynced(supabase, row.id);
      } else if (outcome.status === "skipped") {
        // Stamp anyway — the row is genuinely unmirrorable (no
        // canonical base, no token, voter without airtable key)
        // and we don't want it re-queued every tick. Logged for
        // visibility.
        counters.skipped++;
        console.info("[mirror-airtable] skipped", {
          knockEventId: row.id,
          reason: outcome.reason,
        });
        await stampSynced(supabase, row.id);
      }
    } catch (err) {
      counters.errored++;
      const message = (err as Error).message;
      errors.push({ id: row.id, reason: message });
      console.error("[mirror-airtable] mirror failed", {
        knockEventId: row.id,
        message,
      });
      // Don't stamp — leave it pending for the next tick. If a
      // single row keeps failing we'd want a separate "dead letter"
      // mechanism (mark_as_failed after N attempts); not modelled
      // yet because in practice mirror failures correlate with a
      // bad token and clear the moment it's fixed.
    }
  }

  console.info("[mirror-airtable] tick complete", {
    picked: pending.length,
    ...counters,
    durationMs: Date.now() - startedAt,
  });
  return NextResponse.json({
    ok: true,
    picked: pending.length,
    ...counters,
    errors: errors.slice(0, 10),
  });
}

async function stampSynced(
  supabase: ReturnType<typeof getSupabaseServiceRoleClient>,
  knockEventId: string,
): Promise<void> {
  await supabase
    .from("knock_events")
    .update({ airtable_synced_at: new Date().toISOString() })
    .eq("id", knockEventId);
}
