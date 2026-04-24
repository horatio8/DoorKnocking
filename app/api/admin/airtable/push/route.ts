import { NextResponse } from "next/server";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { enqueueImportJob } from "@/lib/imports/jobs";

// POST /api/admin/airtable/push
//   { import_file_id }
//
// Now a queue-and-return endpoint. The old behaviour ran the whole
// push + import inline, which blew through Vercel's 5-min window on
// larger files. Today we only validate the file + district state,
// enqueue an import_jobs row, and return the job id. The cron worker
// at /api/cron/import-worker drains the queue asynchronously; the
// admin UI polls /api/admin/import-jobs/[id] for progress.
//
// Idempotency: if a runnable job already exists for this import_file,
// we return it instead of creating a duplicate. Admins hitting "Push
// rows" twice in a row won't double-process.

export async function POST(req: Request) {
  const session = await loadSession();
  if (!session || (session.user.role !== "admin" && session.user.role !== "super_admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { import_file_id?: string };
  if (!body.import_file_id) {
    return NextResponse.json({ error: "import_file_id required" }, { status: 400 });
  }

  const supabase = getSupabaseServiceRoleClient();

  const { data: fileRow, error: fErr } = await supabase
    .from("import_files")
    .select("id, district_id, mapping, status, row_count")
    .eq("id", body.import_file_id)
    .maybeSingle();
  if (fErr || !fileRow) {
    return NextResponse.json({ error: "import_file not found" }, { status: 404 });
  }
  const f = fileRow as {
    id: string;
    district_id: string;
    mapping: Record<string, unknown> | null;
    status: string;
    row_count: number | null;
  };
  if (!f.mapping) {
    return NextResponse.json(
      { error: "mapping not saved — confirm the review step first" },
      { status: 409 },
    );
  }

  const { data: dRow } = await supabase
    .from("districts")
    .select(
      "airtable_is_canonical, airtable_base_id, airtable_voters_table_id, airtable_households_table_id",
    )
    .eq("id", f.district_id)
    .maybeSingle();
  const d = dRow as
    | {
        airtable_is_canonical: boolean | null;
        airtable_base_id: string | null;
        airtable_voters_table_id: string | null;
        airtable_households_table_id: string | null;
      }
    | null;
  if (
    !d?.airtable_is_canonical ||
    !d.airtable_base_id ||
    !d.airtable_voters_table_id ||
    !d.airtable_households_table_id
  ) {
    return NextResponse.json(
      { error: "district has no canonical base — run /provision first" },
      { status: 409 },
    );
  }

  // Reuse an existing runnable job for this file if there is one. Keeps
  // double-clicks + replayed POSTs from stacking up duplicates.
  const { data: existing } = await supabase
    .from("import_jobs")
    .select("id, status")
    .eq("import_file_id", f.id)
    .in("status", ["queued", "pushing", "pushed", "importing"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) {
    const row = existing as { id: string; status: string };
    return NextResponse.json({ job_id: row.id, status: row.status, already: true });
  }

  const job = await enqueueImportJob(supabase, {
    importFileId: f.id,
    districtId: f.district_id,
    createdBy: session.user.id,
    rowsTotal: f.row_count ?? 0,
  });

  return NextResponse.json({ job_id: job.id, status: job.status, already: false });
}
