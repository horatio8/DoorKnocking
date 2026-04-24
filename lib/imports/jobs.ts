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

// Atomic "claim the oldest runnable job" used by the cron worker. A row
// is runnable if it's queued OR its prior lock has aged past the TTL
// (handles a worker that crashed mid-run). Returns null if the queue is
// empty, so the cron tick can exit cleanly.
export async function claimNextImportJob(
  supabase: SupabaseClient,
  workerId: string,
): Promise<ImportJob | null> {
  const cutoff = new Date(Date.now() - LOCK_TTL_MINUTES * 60_000).toISOString();
  const { data: candidates, error: findErr } = await supabase
    .from("import_jobs")
    .select("id")
    .in("status", ["queued", "pushing", "importing"])
    .or(`locked_at.is.null,locked_at.lt.${cutoff}`)
    .order("created_at", { ascending: true })
    .limit(1);
  if (findErr) throw new Error(`claimNextImportJob: ${findErr.message}`);
  const candidate = (candidates ?? [])[0] as { id: string } | undefined;
  if (!candidate) return null;

  // Best-effort optimistic lock — another worker may have grabbed it
  // between the SELECT and UPDATE. The `locked_at lt cutoff OR is null`
  // clause keeps us from stealing someone else's healthy lock.
  const { data: claimed, error: claimErr } = await supabase
    .from("import_jobs")
    .update({
      locked_at: new Date().toISOString(),
      locked_by: workerId,
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", candidate.id)
    .or(`locked_at.is.null,locked_at.lt.${cutoff}`)
    .select("*")
    .maybeSingle();
  if (claimErr) throw new Error(`claimNextImportJob: ${claimErr.message}`);
  return (claimed as ImportJob | null) ?? null;
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
