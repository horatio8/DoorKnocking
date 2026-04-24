import { NextResponse } from "next/server";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { resolveAirtableTokenForDistrict } from "@/lib/airtable/credentials";
import { pushFromFile, type PushProgressEvent } from "@/lib/airtable/push-from-file";
import type { FieldMapping } from "@/lib/airtable/mapping";
import {
  claimNextImportJob,
  failImportJob,
  patchImportJob,
  releaseImportJobLock,
} from "@/lib/imports/jobs";

// Cron-driven import worker. Registered via vercel.json; fires every
// minute. Each invocation:
//   1. Atomically claims the oldest runnable job (queued or with an
//      expired lock from a crashed previous worker).
//   2. Loads the file + district + creds.
//   3. Runs pushFromFile end to end, patching progress on the job row
//      as each phase completes so the admin UI can watch it live.
//   4. Marks the job imported or failed, releases the lock.
//
// maxDuration=300 is Vercel's Pro ceiling. A 10k-row push fits inside
// that comfortably now that geocoding is batched (~20s for Census +
// Mapbox fallback). If a future job exceeds the window the lock TTL
// lets the next cron tick reclaim it.

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request) {
  // Vercel cron hits with Authorization: Bearer <CRON_SECRET>. Anyone
  // else gets 403 — otherwise the queue is an open invitation to burn
  // Airtable + Mapbox quota.
  const authHeader = req.headers.get("authorization");
  const expected = process.env.CRON_SECRET;
  const isCron = expected && authHeader === `Bearer ${expected}`;
  const isVercelCron = req.headers.get("x-vercel-cron") === "1";
  if (!isCron && !isVercelCron) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const supabase = getSupabaseServiceRoleClient();
  const workerId = `vercel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const job = await claimNextImportJob(supabase, workerId);
  if (!job) return NextResponse.json({ ok: true, picked: 0 });

  try {
    const { data: fileRow } = await supabase
      .from("import_files")
      .select("*")
      .eq("id", job.import_file_id)
      .maybeSingle();
    const file = fileRow as {
      id: string;
      district_id: string;
      storage_path: string;
      original_filename: string;
      mapping: FieldMapping | null;
    } | null;
    if (!file) throw new Error("import_file not found");
    if (!file.mapping) throw new Error("import_file has no saved mapping");

    const { data: districtRow } = await supabase
      .from("districts")
      .select(
        "airtable_base_id, airtable_voters_table_id, airtable_households_table_id, airtable_is_canonical",
      )
      .eq("id", file.district_id)
      .maybeSingle();
    const district = districtRow as {
      airtable_base_id: string | null;
      airtable_voters_table_id: string | null;
      airtable_households_table_id: string | null;
      airtable_is_canonical: boolean | null;
    } | null;
    if (
      !district?.airtable_is_canonical ||
      !district.airtable_base_id ||
      !district.airtable_voters_table_id ||
      !district.airtable_households_table_id
    ) {
      throw new Error("district has no canonical base — run /provision first");
    }

    const creds = await resolveAirtableTokenForDistrict(file.district_id);
    if (!creds?.token) throw new Error("no airtable token");

    await pushFromFile({
      supabase,
      districtId: file.district_id,
      importFileId: file.id,
      baseId: district.airtable_base_id,
      votersTableId: district.airtable_voters_table_id,
      householdsTableId: district.airtable_households_table_id,
      mapping: file.mapping,
      storagePath: file.storage_path,
      originalFilename: file.original_filename,
      airtableToken: creds.token,
      onProgress: async (evt: PushProgressEvent) => {
        switch (evt.phase) {
          case "parsed":
            await patchImportJob(supabase, job.id, {
              rows_total: evt.rowsTotal,
              status: "pushing",
            });
            return;
          case "pushing":
            await patchImportJob(supabase, job.id, { status: "pushing" });
            return;
          case "pushed":
            await patchImportJob(supabase, job.id, {
              status: "pushed",
              rows_pushed: evt.votersPushed,
            });
            return;
          case "importing":
            await patchImportJob(supabase, job.id, { status: "importing" });
            return;
          case "imported":
            await patchImportJob(supabase, job.id, {
              status: "imported",
              rows_fetched: evt.summary.records_fetched,
              rows_geocoded: evt.summary.geocoded,
              rows_failed: evt.summary.geocode_failed,
              rows_imported: evt.summary.voters_upserted,
              finished_at: new Date().toISOString(),
              locked_at: null,
              locked_by: null,
            });
            return;
        }
      },
    });

    return NextResponse.json({ ok: true, picked: 1, jobId: job.id });
  } catch (err) {
    const message = (err as Error).message || "import worker crashed";
    await failImportJob(supabase, job.id, message).catch(() => undefined);
    // Release the lock even if failImportJob fails so the queue keeps
    // moving. The caught error above is the one we record.
    await releaseImportJobLock(supabase, job.id).catch(() => undefined);
    return NextResponse.json({ ok: false, error: message, jobId: job.id }, { status: 500 });
  }
}
