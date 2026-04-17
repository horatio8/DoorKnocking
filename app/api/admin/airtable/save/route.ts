import { NextResponse } from "next/server";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { FieldMapping } from "@/lib/airtable/mapping";

interface Body {
  districtId: string;
  baseId: string;
  tableId: string;
  mapping: FieldMapping;
}

export async function PUT(req: Request) {
  const session = await loadSession();
  if (!session || (session.user.role !== "admin" && session.user.role !== "super_admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  const { districtId, baseId, tableId, mapping } = body;
  if (!districtId || !baseId || !tableId || !mapping) {
    return NextResponse.json({ error: "districtId, baseId, tableId, mapping required" }, { status: 400 });
  }

  const supabase = getSupabaseServiceRoleClient();
  const { error } = await supabase
    .from("districts")
    .update({
      airtable_base_id: baseId,
      airtable_voters_table_id: tableId,
      airtable_field_mapping: mapping,
      airtable_import_status: "ready",
      airtable_last_error: null,
    })
    .eq("id", districtId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
