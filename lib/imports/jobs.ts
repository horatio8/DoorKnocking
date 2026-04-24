// Helpers for the import_jobs queue. Shared between the enqueue
// endpoint, the cron worker, and the admin status API.

import type { SupabaseClient } from "@supabase/supabase-js";

export type ImportJobStatus =
  | "queued"
  | "pushing"
  | "pushed"
  | "importing"
  | "imported"
  | "failed"
  | "paused";

export interface ImportJob {
  id: string;
  import_file_id: string;
  district_id: string;
  created_by: string | null;
  status: ImportJobStatus;
  rows_total: number;
  rows_pushed: number;
  rows_fetched: number;
  rows_geocoded: number;
  rows_imported: number;
  rows_failed: number;
  error_message: string | null;
  error_detail: Record<string, unknown> | null;
  locked_at: string | null;
  locked_by: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}

const LOCK_TTL_MINUTES = 5;

// Creates a new queued job for an uploaded file. Returns the row.
export async function enqueueImportJob(
  supabase: SupabaseClient,
  args: {
    importFileId: string;
    districtId: string;
    createdBy: string | null;
    rowsTotal: number;
  },
): Promise<ImportJob> {
  const { data, error } = await supabase
    .from("import_jobs")
    .insert({
      import_file_id: args.importFileId,
      district_id: args.districtId,
      created_by: args.createdBy,
      rows_total: args.rowsTotal,
      status: "queued",
    })
    .select("*")
    .single();
  if (error) throw new Error(`enqueueImportJob: ${error.message}`);
  return data as ImportJob;
}

// Atomic "claim the oldest runnable job" used by the cron worker. Two
// passes:
//   1. Look for jobs with locked_at IS NULL (the common case — fresh
//      queue items or jobs released cleanly).
//   2. If none, look for stale locks (locked_at older than the TTL) so
//      a worker that crashed mid-run doesn't strand its job forever.
//
// Originally a single .or() but Supabase's PostgREST query string
// mangled ISO timestamps with colons inside .or(), causing the SELECT
// to return zero candidates even when a queued unlocked job existed.
// Two .is() / .lt() calls are unambiguous.
export async function claimNextImportJob(
  supabase: SupabaseClient,
  workerId: string,
): Promise<ImportJob | null> {
  const findCandidate = async (): Promise<{ id: string } | null> => {
    // Unlocked first.
    const unlocked = await supabase
      .from("import_jobs")
      .select("id")
      .in("status", ["queued", "pushing", "importing"])
      .is("locked_at", null)
      .order("created_at", { ascending: true })
      .limit(1);
    if (unlocked.error) throw new Error(`claimNextImportJob: ${unlocked.error.message}`);
    const fresh = (unlocked.data ?? [])[0] as { id: string } | undefined;
    if (fresh) return fresh;

    // Stale lock — worker crashed mid-run.
    const cutoff = new Date(Date.now() - LOCK_TTL_MINUTES * 60_000).toISOString();
    const stale = await supabase
      .from("import_jobs")
      .select("id")
      .in("status", ["queued", "pushing", "importing"])
      .lt("locked_at", cutoff)
      .order("created_at", { ascending: true })
      .limit(1);
    if (stale.error) throw new Error(`claimNextImportJob: ${stale.error.message}`);
    return ((stale.data ?? [])[0] as { id: string } | undefined) ?? null;
  };

  const candidate = await findCandidate();
  if (!candidate) return null;

  // Optimistic claim — split into two attempts so the WHERE clauses
  // stay simple (avoids the same .or() mangling that bit the SELECT).
  // Pass 1: claim if currently unlocked.
  const claimedFresh = (await supabase
    .from("import_jobs")
    .update({
      locked_at: new Date().toISOString(),
      locked_by: workerId,
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", candidate.id)
    .is("locked_at", null)
    .select("*")
    .maybeSingle()) as { data: ImportJob | null; error: { message: string } | null };
  if (claimedFresh.error) {
    throw new Error(`claimNextImportJob: ${claimedFresh.error.message}`);
  }
  if (claimedFresh.data) return claimedFresh.data;

  // Pass 2: claim a stale lock.
  const cutoff = new Date(Date.now() - LOCK_TTL_MINUTES * 60_000).toISOString();
  const claimedStale = (await supabase
    .from("import_jobs")
    .update({
      locked_at: new Date().toISOString(),
      locked_by: workerId,
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", candidate.id)
    .lt("locked_at", cutoff)
    .select("*")
    .maybeSingle()) as { data: ImportJob | null; error: { message: string } | null };
  if (claimedStale.error) {
    throw new Error(`claimNextImportJob: ${claimedStale.error.message}`);
  }
  return claimedStale.data ?? null;
}

// Patch a job row with progress counters + status. Always bumps
// updated_at so pollers see fresh data.
export async function patchImportJob(
  supabase: SupabaseClient,
  id: string,
  patch: Partial<ImportJob>,
): Promise<void> {
  const { error } = await supabase
    .from("import_jobs")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`patchImportJob: ${error.message}`);
}

// Release the worker lock without changing status — used when we've hit
// a cron timeout mid-run. Next tick will reclaim based on locked_at
// cutoff, but releasing early keeps the queue moving when workers
// shut down cleanly.
export async function releaseImportJobLock(
  supabase: SupabaseClient,
  id: string,
): Promise<void> {
  await supabase
    .from("import_jobs")
    .update({ locked_at: null, locked_by: null, updated_at: new Date().toISOString() })
    .eq("id", id);
}

export async function failImportJob(
  supabase: SupabaseClient,
  id: string,
  message: string,
  detail?: Record<string, unknown>,
): Promise<void> {
  await patchImportJob(supabase, id, {
    status: "failed",
    error_message: message,
    error_detail: detail ?? null,
    finished_at: new Date().toISOString(),
    locked_at: null,
    locked_by: null,
  });
}
