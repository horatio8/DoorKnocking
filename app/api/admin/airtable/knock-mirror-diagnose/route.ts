import { NextResponse } from "next/server";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { resolveAirtableTokenForDistrict } from "@/lib/airtable/credentials";
import { mirrorKnockToAirtable } from "@/lib/airtable/mirror-knock";

// GET /api/admin/airtable/knock-mirror-diagnose
//   ?district_id=...   (optional — narrow to one district)
//   &probe=1           (optional — actually call mirrorKnockToAirtable
//                        on the most recent unsynced row and return the
//                        outcome, INCLUDING the real error/skip reason
//                        the inline path silently swallows)
//
// Why this exists: syncKnockNow swallows mirror failures so a Supabase
// knock save never depends on Airtable being up. That's correct, but
// it makes "Airtable hasn't updated" hard to debug without poking
// straight at the source. This endpoint:
//   - counts pending vs synced knock_events
//   - lists the 10 most recent knock_events with their sync state
//   - per-district: canonical flag, base/knocks-table ids, token status
//   - with ?probe=1 — replays mirrorKnockToAirtable against the latest
//     unsynced row and surfaces the verbatim outcome (status, reason,
//     thrown message)
//
// Read-only by default. ?probe=1 hits Airtable but only via a single
// idempotent mirror call (which would have run on the next cron tick
// anyway), so it's safe to retry.

export const dynamic = "force-dynamic";

interface KnockRow {
  id: string;
  household_id: string;
  voter_id: string | null;
  status: string;
  knocked_at: string;
  airtable_synced_at: string | null;
  airtable_knock_rec_id: string | null;
}

export async function GET(req: Request) {
  const session = await loadSession();
  if (!session || (session.user.role !== "admin" && session.user.role !== "super_admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const url = new URL(req.url);
  const districtId = url.searchParams.get("district_id");
  const shouldProbe = url.searchParams.get("probe") === "1";

  const supabase = getSupabaseServiceRoleClient();

  // Pending + total counts. If districtId is given, scope by joining
  // through voters.district_id (knock_events itself doesn't carry
  // district_id, the voter does).
  const baseQuery = () =>
    districtId
      ? supabase
          .from("knock_events")
          .select("id, voters!voter_id!inner(district_id)", { count: "exact", head: true })
          .eq("voters.district_id", districtId)
      : supabase.from("knock_events").select("id", { count: "exact", head: true });

  const [{ count: total }, { count: pending }, { count: synced }] = await Promise.all([
    baseQuery(),
    baseQuery().is("airtable_synced_at", null),
    baseQuery().not("airtable_synced_at", "is", null),
  ]);

  // 10 most recent knock_events. For each, also pull the voter's
  // district_id + airtable_voter_key — both are required for the
  // mirror, and missing keys are the most common silent skip reason.
  const recentQuery = supabase
    .from("knock_events")
    .select(
      "id, household_id, voter_id, status, knocked_at, airtable_synced_at, airtable_knock_rec_id, voters!voter_id(district_id, airtable_voter_key)",
    )
    .order("knocked_at", { ascending: false })
    .limit(10);
  const { data: recentRows } = districtId
    ? await recentQuery.eq("voters.district_id", districtId)
    : await recentQuery;
  const recent = (recentRows ?? []) as Array<
    KnockRow & {
      voters:
        | { district_id: string; airtable_voter_key: string | null }
        | Array<{ district_id: string; airtable_voter_key: string | null }>
        | null;
    }
  >;
  const recentNormalized = recent.map((r) => {
    const v = Array.isArray(r.voters) ? r.voters[0] : r.voters;
    return {
      id: r.id,
      status: r.status,
      knocked_at: r.knocked_at,
      airtable_synced_at: r.airtable_synced_at,
      airtable_knock_rec_id: r.airtable_knock_rec_id,
      voter_id: r.voter_id,
      voter_district_id: v?.district_id ?? null,
      voter_airtable_key: v?.airtable_voter_key ?? null,
    };
  });

  // Per-district health snapshot. If districtId is set we scope to one;
  // otherwise we surface every district that appears in the recent
  // sample so the admin can see which client is mis-configured.
  const districtIds = new Set<string>();
  if (districtId) districtIds.add(districtId);
  for (const r of recentNormalized) {
    if (r.voter_district_id) districtIds.add(r.voter_district_id);
  }
  const districts: Array<{
    id: string;
    name: string | null;
    canonical: boolean | null;
    base_id: string | null;
    knocks_table_id: string | null;
    voters_table_id: string | null;
    households_table_id: string | null;
    token_resolved: boolean;
    token_source: string | null;
  }> = [];
  for (const id of districtIds) {
    const { data: drow } = await supabase
      .from("districts")
      .select(
        "id, name, airtable_is_canonical, airtable_base_id, airtable_knocks_table_id, airtable_voters_table_id, airtable_households_table_id",
      )
      .eq("id", id)
      .maybeSingle();
    const d = drow as {
      id: string;
      name: string | null;
      airtable_is_canonical: boolean | null;
      airtable_base_id: string | null;
      airtable_knocks_table_id: string | null;
      airtable_voters_table_id: string | null;
      airtable_households_table_id: string | null;
    } | null;
    if (!d) continue;
    const creds = await resolveAirtableTokenForDistrict(id);
    districts.push({
      id: d.id,
      name: d.name,
      canonical: d.airtable_is_canonical,
      base_id: d.airtable_base_id,
      knocks_table_id: d.airtable_knocks_table_id,
      voters_table_id: d.airtable_voters_table_id,
      households_table_id: d.airtable_households_table_id,
      token_resolved: Boolean(creds?.token),
      token_source: (creds as { source?: string } | null)?.source ?? null,
    });
  }

  // Latest sync timestamps — quick "is the cron firing?" signal.
  const { data: lastSyncedRow } = await supabase
    .from("knock_events")
    .select("id, airtable_synced_at")
    .not("airtable_synced_at", "is", null)
    .order("airtable_synced_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const lastSynced = lastSyncedRow as { id: string; airtable_synced_at: string } | null;

  // Optional: replay the mirror on the most recent unsynced row and
  // surface the verbatim outcome. This is the part that catches the
  // silent failures — we re-run the same code path the inline + cron
  // hit, but bubble the error up instead of swallowing it.
  let probe:
    | {
        ran: true;
        knockEventId: string;
        outcome: { status: string; reason?: string; airtableRecId?: string };
      }
    | { ran: true; knockEventId: string; threw: string }
    | { ran: false; reason: string }
    | null = null;
  if (shouldProbe) {
    const recentUnsynced = recentNormalized.find((r) => r.airtable_synced_at == null);
    if (!recentUnsynced) {
      probe = { ran: false, reason: "no unsynced knock_event in the recent sample" };
    } else {
      try {
        const outcome = await mirrorKnockToAirtable({
          supabase,
          knockEventId: recentUnsynced.id,
        });
        probe = {
          ran: true,
          knockEventId: recentUnsynced.id,
          outcome: {
            status: outcome.status,
            reason: "reason" in outcome ? outcome.reason : undefined,
            airtableRecId: "airtableRecId" in outcome ? outcome.airtableRecId : undefined,
          },
        };
        // Stamp synced_at on ok/skipped so we don't re-probe the same
        // row endlessly. Matches what the cron does.
        if (outcome.status === "ok" || outcome.status === "skipped") {
          const update: { airtable_synced_at: string; airtable_knock_rec_id?: string } = {
            airtable_synced_at: new Date().toISOString(),
          };
          if (outcome.status === "ok") {
            update.airtable_knock_rec_id = outcome.airtableRecId;
          }
          await supabase.from("knock_events").update(update).eq("id", recentUnsynced.id);
        }
      } catch (err) {
        probe = {
          ran: true,
          knockEventId: recentUnsynced.id,
          threw: (err as Error).message,
        };
      }
    }
  }

  const issues: string[] = [];
  for (const d of districts) {
    if (!d.canonical) issues.push(`${d.name ?? d.id}: airtable_is_canonical=false`);
    if (!d.base_id) issues.push(`${d.name ?? d.id}: no airtable_base_id`);
    if (!d.knocks_table_id) {
      issues.push(
        `${d.name ?? d.id}: no airtable_knocks_table_id — Knocks table never provisioned. The mirror skips & stamps these, never to retry.`,
      );
    }
    if (!d.token_resolved) issues.push(`${d.name ?? d.id}: token unresolvable`);
  }
  if ((pending ?? 0) > 200) {
    issues.push(`${pending} pending knock_events — cron may not be firing`);
  }
  for (const r of recentNormalized.slice(0, 5)) {
    if (!r.voter_id) {
      issues.push(`${r.id} has no voter_id (no_answer at household level — mirror skips by design)`);
    } else if (!r.voter_airtable_key) {
      issues.push(`${r.id} voter ${r.voter_id} missing airtable_voter_key — won't link in Airtable`);
    }
  }

  return NextResponse.json({
    counts: {
      total: total ?? 0,
      pending: pending ?? 0,
      synced: synced ?? 0,
    },
    last_synced_at: lastSynced?.airtable_synced_at ?? null,
    last_synced_id: lastSynced?.id ?? null,
    recent: recentNormalized,
    districts,
    probe,
    issues,
  });
}
