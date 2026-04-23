import { NextResponse } from "next/server";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { resolveAirtableTokenForDistrict } from "@/lib/airtable/credentials";
import { pushFromFile } from "@/lib/airtable/push-from-file";
import type { FieldMapping } from "@/lib/airtable/mapping";

// POST /api/admin/airtable/push
//   { import_file_id }
//
// Pushes a staged file into the canonical Airtable base, then runs the
// regular importer so the Supabase side catches up. The district must
// already have airtable_is_canonical=true and the four canonical
// table ids set (done by /api/admin/airtable/provision).

export const maxDuration = 300;

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
    .select("*")
    .eq("id", body.import_file_id)
    .maybeSingle();
  if (fErr || !fileRow) {
    return NextResponse.json({ error: "import_file not found" }, { status: 404 });
  }
  const f = fileRow as {
    id: string;
    district_id: string;
    storage_path: string;
    original_filename: string;
    mapping: FieldMapping | null;
    status: string;
  };
  if (!f.mapping) {
    return NextResponse.json({ error: "mapping not saved — confirm the review step first" }, { status: 409 });
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
  if (!d?.airtable_is_canonical || !d.airtable_base_id || !d.airtable_voters_table_id || !d.airtable_households_table_id) {
    return NextResponse.json(
      { error: "district has no canonical base — run /provision first" },
      { status: 409 },
    );
  }

  const creds = await resolveAirtableTokenForDistrict(f.district_id);
  if (!creds?.token) {
    return NextResponse.json({ error: "no airtable token" }, { status: 412 });
  }

  try {
    const result = await pushFromFile({
      supabase,
      districtId: f.district_id,
      importFileId: f.id,
      baseId: d.airtable_base_id,
      votersTableId: d.airtable_voters_table_id,
      householdsTableId: d.airtable_households_table_id,
      mapping: f.mapping,
      storagePath: f.storage_path,
      originalFilename: f.original_filename,
      airtableToken: creds.token,
    });
    return NextResponse.json({
      ok: true,
      pushed: result.voters_pushed,
      households_pushed: result.households_pushed,
      imported: result.import_summary.voters_upserted,
      summary: result.import_summary,
    });
  } catch (err) {
    await supabase
      .from("import_files")
      .update({ status: "failed", error_message: (err as Error).message })
      .eq("id", f.id);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
