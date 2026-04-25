import { NextResponse } from "next/server";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { resolveAirtableTokenForDistrict } from "@/lib/airtable/credentials";

// GET /api/admin/airtable/diagnose?district_id=...
//
// Single-shot recovery diagnostic for the file-upload import flow. Pulls
// every state snapshot we'd want to see when an import "doesn't move":
//   - the districts row (canonical-base linkage, last error)
//   - the most recent import_files for this district (status/mapping)
//   - the latest import_jobs rows (status, locks, errors)
//   - household + voter row counts in Supabase
//   - whether the Airtable token resolves and whether the canonical
//     base actually has rows (a HEAD-style probe via the meta endpoint)
//
// All read-only — safe to hit repeatedly. Admin-only. Built so the
// admin (or a chat agent) can decide between "redeploy", "re-push",
// "reimport", or "fix Airtable credentials" without hand-querying
// Supabase.

export const dynamic = "force-dynamic";

interface ImportFileRow {
  id: string;
  status: string | null;
  row_count: number | null;
  original_filename: string | null;
  storage_path: string | null;
  mapping: unknown;
  pushed_at: string | null;
  imported_at: string | null;
  error_message: string | null;
  created_at: string;
}

interface ImportJobRow {
  id: string;
  status: string;
  rows_total: number;
  rows_pushed: number;
  rows_fetched: number;
  rows_geocoded: number;
  rows_imported: number;
  rows_failed: number;
  error_message: string | null;
  locked_at: string | null;
  locked_by: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function GET(req: Request) {
  const session = await loadSession();
  if (!session || (session.user.role !== "admin" && session.user.role !== "super_admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const url = new URL(req.url);
  const districtId = url.searchParams.get("district_id");
  if (!districtId) {
    return NextResponse.json({ error: "district_id required" }, { status: 400 });
  }

  const supabase = getSupabaseServiceRoleClient();

  const { data: districtRow, error: dErr } = await supabase
    .from("districts")
    .select(
      "id, name, slug, client_id, airtable_is_canonical, airtable_base_id, airtable_voters_table_id, airtable_households_table_id, airtable_import_status, airtable_last_imported_at, airtable_last_error",
    )
    .eq("id", districtId)
    .maybeSingle();
  if (dErr || !districtRow) {
    return NextResponse.json({ error: "district not found", detail: dErr?.message }, { status: 404 });
  }
  const district = districtRow as {
    id: string;
    name: string;
    slug: string | null;
    client_id: string | null;
    airtable_is_canonical: boolean | null;
    airtable_base_id: string | null;
    airtable_voters_table_id: string | null;
    airtable_households_table_id: string | null;
    airtable_import_status: string | null;
    airtable_last_imported_at: string | null;
    airtable_last_error: string | null;
  };

  // Most recent import_files (typically there's just one in flight, but
  // surface up to 5 so we can see history at a glance).
  const { data: filesRows } = await supabase
    .from("import_files")
    .select(
      "id, status, row_count, original_filename, storage_path, mapping, pushed_at, imported_at, error_message, created_at",
    )
    .eq("district_id", districtId)
    .order("created_at", { ascending: false })
    .limit(5);
  const files = (filesRows ?? []) as ImportFileRow[];

  // Up to 10 most recent import_jobs.
  const { data: jobsRows } = await supabase
    .from("import_jobs")
    .select(
      "id, status, rows_total, rows_pushed, rows_fetched, rows_geocoded, rows_imported, rows_failed, error_message, locked_at, locked_by, started_at, finished_at, created_at, updated_at",
    )
    .eq("district_id", districtId)
    .order("created_at", { ascending: false })
    .limit(10);
  const jobs = (jobsRows ?? []) as ImportJobRow[];

  // Supabase row counts (current state of truth).
  const [{ count: householdCount }, { count: voterCount }, { count: hhWithCoords }] = await Promise.all([
    supabase
      .from("households")
      .select("id", { count: "exact", head: true })
      .eq("district_id", districtId),
    supabase
      .from("voters")
      .select("id", { count: "exact", head: true })
      .eq("district_id", districtId),
    supabase
      .from("households")
      .select("id", { count: "exact", head: true })
      .eq("district_id", districtId)
      .not("lat", "is", null)
      .not("lng", "is", null),
  ]);

  // Airtable token probe — never returns the token itself, just whether
  // we can resolve one and what shape it has.
  const creds = await resolveAirtableTokenForDistrict(districtId);
  const tokenInfo = creds
    ? {
        resolved: true,
        source: (creds as { source?: string }).source ?? null,
        token_prefix: creds.token.slice(0, 4),
      }
    : { resolved: false, source: null, token_prefix: null };

  // Validate the canonical base + voters table by hitting Airtable's
  // meta API. Cheap (one HTTP) and tells us whether the IDs the queue
  // worker would use are actually live.
  let airtableProbe: {
    ok: boolean;
    status?: number;
    detail?: string;
    voters_table_records_visible?: number;
  } = { ok: false };
  if (
    creds?.token &&
    district.airtable_base_id &&
    district.airtable_voters_table_id
  ) {
    try {
      const probeUrl = `https://api.airtable.com/v0/${district.airtable_base_id}/${district.airtable_voters_table_id}?pageSize=1`;
      const res = await fetch(probeUrl, {
        headers: { Authorization: `Bearer ${creds.token}` },
        cache: "no-store",
      });
      if (res.ok) {
        const body = (await res.json()) as { records?: unknown[] };
        airtableProbe = {
          ok: true,
          status: res.status,
          voters_table_records_visible: Array.isArray(body.records) ? body.records.length : 0,
        };
      } else {
        airtableProbe = {
          ok: false,
          status: res.status,
          detail: (await res.text()).slice(0, 400),
        };
      }
    } catch (err) {
      airtableProbe = { ok: false, detail: (err as Error).message };
    }
  } else {
    airtableProbe = {
      ok: false,
      detail:
        !creds?.token
          ? "no airtable token resolvable for this district"
          : "district has no canonical base ids",
    };
  }

  const issues: string[] = [];
  if (!district.airtable_is_canonical) {
    issues.push("district.airtable_is_canonical=false — re-run /provision");
  }
  if (!district.airtable_base_id || !district.airtable_voters_table_id) {
    issues.push("district missing canonical base/voters table ids");
  }
  if (!tokenInfo.resolved) {
    issues.push("airtable token unresolvable — saveAirtableToken from settings");
  }
  if (district.airtable_is_canonical && !airtableProbe.ok) {
    issues.push(`airtable probe failed: ${airtableProbe.detail ?? `status ${airtableProbe.status}`}`);
  }
  const latestJob = jobs[0];
  if (latestJob && latestJob.status === "queued" && !latestJob.locked_at) {
    const ageMin = Math.round(
      (Date.now() - new Date(latestJob.created_at).getTime()) / 60_000,
    );
    if (ageMin > 2) {
      issues.push(
        `latest import_job has been queued+unlocked for ${ageMin} minute(s) — cron isn't firing or worker is throwing before claim. Try GET /api/cron/import-worker as admin to drive it inline.`,
      );
    }
  }
  if ((householdCount ?? 0) === 0 && airtableProbe.ok) {
    issues.push(
      "0 households in Supabase but Airtable canonical base reachable — POST /api/admin/airtable/reimport to recover without re-pushing",
    );
  }

  return NextResponse.json({
    district,
    counts: {
      households: householdCount ?? 0,
      households_with_coords: hhWithCoords ?? 0,
      voters: voterCount ?? 0,
    },
    files,
    jobs,
    airtable: { token: tokenInfo, probe: airtableProbe },
    issues,
  });
}
