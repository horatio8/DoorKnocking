import { NextResponse } from "next/server";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { runImport } from "@/lib/airtable/import";
import { resolveAirtableToken } from "@/lib/airtable/credentials";

interface Body {
  districtId: string;
  limit?: number;
}

export const maxDuration = 300; // up to 5 min on Vercel Pro

export async function POST(req: Request) {
  const session = await loadSession();
  if (!session || (session.user.role !== "admin" && session.user.role !== "super_admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  const { districtId, limit } = body;
  if (!districtId) return NextResponse.json({ error: "districtId required" }, { status: 400 });

  const supabase = getSupabaseServiceRoleClient();
  const { data: district, error: dErr } = await supabase
    .from("districts")
    .select("airtable_base_id, airtable_voters_table_id, airtable_field_mapping, client_id")
    .eq("id", districtId)
    .maybeSingle();
  if (dErr || !district) {
    return NextResponse.json({ error: "district not found" }, { status: 404 });
  }
  if (!district.airtable_base_id || !district.airtable_voters_table_id || !district.airtable_field_mapping) {
    return NextResponse.json({ error: "district missing airtable connection or mapping" }, { status: 400 });
  }

  const creds = await resolveAirtableToken(district.client_id);
  if (!creds) {
    return NextResponse.json({ error: "No Airtable token configured for this client." }, { status: 412 });
  }

  try {
    const summary = await runImport({
      supabase,
      districtId,
      baseId: district.airtable_base_id,
      tableId: district.airtable_voters_table_id,
      mapping: district.airtable_field_mapping,
      airtableToken: creds.token,
      limit,
    });
    return NextResponse.json({ ok: true, summary });
  } catch (err) {
    const message = (err as Error).message;
    await supabase
      .from("districts")
      .update({ airtable_import_status: "error", airtable_last_error: message })
      .eq("id", districtId);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
