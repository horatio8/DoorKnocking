import { NextResponse } from "next/server";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { detectFormat, parseFile } from "@/lib/airtable/file-parser";
import { proposeMapping } from "@/lib/airtable/proposer";

// POST /api/admin/airtable/upload  (multipart)
//   file: CSV or XLSX
//   district_id: string
//
// Stages the file in the `import-files` bucket, parses it in-memory,
// runs the Claude mapping proposer against the *file headers* (not an
// Airtable table), and returns a preview payload the wizard renders.
// The row itself is persisted in public.import_files for later replay.

const BUCKET = "import-files";
const MAX_BYTES = 25 * 1024 * 1024; // 25 MB
const PREVIEW_ROWS = 5;
const PROPOSER_SAMPLE_ROWS = 25;

export const maxDuration = 120;

export async function POST(req: Request) {
  const session = await loadSession();
  if (!session || (session.user.role !== "admin" && session.user.role !== "super_admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "multipart/form-data required" }, { status: 400 });

  const districtId = form.get("district_id");
  const file = form.get("file");
  if (typeof districtId !== "string" || !(file instanceof Blob)) {
    return NextResponse.json({ error: "district_id and file required" }, { status: 400 });
  }
  if (file.size === 0) return NextResponse.json({ error: "empty file" }, { status: 400 });
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: `file exceeds ${MAX_BYTES} bytes` }, { status: 413 });
  }

  const filename = (file as File).name ?? "upload";
  const mimeType = (file as File).type || null;
  const format = detectFormat(filename, mimeType);
  if (!format) {
    return NextResponse.json({ error: "only CSV or XLSX files are accepted" }, { status: 415 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let parsed;
  try {
    parsed = parseFile(buffer, format);
  } catch (err) {
    return NextResponse.json({ error: `parse failed: ${(err as Error).message}` }, { status: 400 });
  }
  if (parsed.header.length === 0) {
    return NextResponse.json({ error: "no header row detected" }, { status: 400 });
  }

  const supabase = getSupabaseServiceRoleClient();

  const objectPath = `${districtId}/${Date.now()}-${slugify(filename)}`;
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(objectPath, buffer, {
      contentType: mimeType ?? (format === "csv" ? "text/csv" : "application/vnd.ms-excel"),
      upsert: false,
    });
  if (upErr) return NextResponse.json({ error: `storage: ${upErr.message}` }, { status: 500 });

  const { data: row, error: insErr } = await supabase
    .from("import_files")
    .insert({
      district_id: districtId,
      uploaded_by: session.user.id,
      storage_path: objectPath,
      original_filename: filename,
      mime_type: mimeType,
      size_bytes: file.size,
      row_count: parsed.rowCount,
      parsed_header: parsed.header,
      status: "parsed",
    })
    .select("*")
    .single();
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  // Ask Claude to match our canonical PLATFORM_FIELDS onto the file's
  // header columns. The proposer expects AirtableField shapes, so we
  // synthesise one per header with a loose "text" type.
  let proposal;
  try {
    proposal = await proposeMapping({
      airtableTableName: filename,
      airtableFields: parsed.header.map((name) => ({
        id: name,
        name,
        type: "singleLineText",
      })),
      sampleRows: parsed.rows.slice(0, PROPOSER_SAMPLE_ROWS).map((r, i) => ({
        id: `row-${i}`,
        fields: r,
      })),
    });
  } catch (err) {
    // Don't block the upload if Claude misbehaves — the admin can still
    // hand-map on the next step.
    console.warn("[upload] proposer failed, returning empty mapping:", err);
    proposal = null;
  }

  return NextResponse.json({
    import_file: row,
    preview: {
      header: parsed.header,
      rows: parsed.rows.slice(0, PREVIEW_ROWS),
      total_rows: parsed.rowCount,
    },
    proposal,
  });
}

function slugify(s: string): string {
  return s
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}
