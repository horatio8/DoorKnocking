import { NextResponse } from "next/server";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";

// PUT /api/admin/airtable/upload/mapping
//   { import_file_id, mapping: { canonical_field_key: csv_column | null } }
//
// Persists the admin-confirmed header mapping onto the import_files row
// so the push step has a stable source of truth.

export async function PUT(req: Request) {
  const session = await loadSession();
  if (!session || (session.user.role !== "admin" && session.user.role !== "super_admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    import_file_id?: string;
    mapping?: Record<string, string | null>;
  };
  if (!body.import_file_id || !body.mapping) {
    return NextResponse.json({ error: "import_file_id + mapping required" }, { status: 400 });
  }

  const supabase = getSupabaseServiceRoleClient();
  const { error } = await supabase
    .from("import_files")
    .update({ mapping: body.mapping })
    .eq("id", body.import_file_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
