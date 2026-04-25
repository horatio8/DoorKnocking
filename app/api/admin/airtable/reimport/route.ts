import { NextResponse } from "next/server";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { resolveAirtableTokenForDistrict } from "@/lib/airtable/credentials";
import { runImport } from "@/lib/airtable/import";
import { VOTER_FIELDS, HOUSEHOLD_FIELDS } from "@/lib/airtable/schema";
import type { FieldMapping } from "@/lib/airtable/mapping";

// POST /api/admin/airtable/reimport
//   { district_id }
//
// Recovery path for districts whose Airtable canonical base is already
// populated but whose Supabase side is empty — typically because an
// inline /push timed out during geocoding before runImport finished.
// This route skips batchCreate entirely and only runs the
// Airtable->Supabase sync (geocode + upsert households + upsert voters)
// against the existing canonical base.
//
// Idempotent: runImport upserts on (district_id, airtable_hh_rec_id)
// and (district_id, airtable_voter_key), so calling this multiple
// times converges instead of duplicating.

export const maxDuration = 300;

// The canonical base uses a fixed identity-style mapping — same one
// pushFromFile.ts uses when populating the Airtable side. Kept in sync
// with that file's CANONICAL_IMPORT_MAPPING.
const CANONICAL_IMPORT_MAPPING: FieldMapping = {
  airtable_voter_key: VOTER_FIELDS.voterKey,
  household_rec_id: HOUSEHOLD_FIELDS.householdKey,
  state_voter_id: null,
  client_id: null,
  first_name: VOTER_FIELDS.firstName,
  middle_name: VOTER_FIELDS.middleName,
  last_name: VOTER_FIELDS.lastName,
  suffix: VOTER_FIELDS.suffix,
  address_line1: VOTER_FIELDS.address,
  unit: VOTER_FIELDS.unit,
  city: VOTER_FIELDS.city,
  state: VOTER_FIELDS.state,
  zip: VOTER_FIELDS.zip,
  zip4: null,
  lat: null,
  lng: null,
  neighborhood_id: null,
  primary_phone: VOTER_FIELDS.phone,
  household_party: null,
  observed_party: null,
  official_party: VOTER_FIELDS.party,
  calculated_party: null,
  moved: null,
};

export async function POST(req: Request) {
  const session = await loadSession();
  if (!session || (session.user.role !== "admin" && session.user.role !== "super_admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { district_id?: string };
  if (!body.district_id) {
    return NextResponse.json({ error: "district_id required" }, { status: 400 });
  }

  const supabase = getSupabaseServiceRoleClient();
  const { data: dRow, error: dErr } = await supabase
    .from("districts")
    .select(
      "airtable_is_canonical, airtable_base_id, airtable_voters_table_id",
    )
    .eq("id", body.district_id)
    .maybeSingle();
  if (dErr || !dRow) {
    return NextResponse.json({ error: "district not found" }, { status: 404 });
  }
  const d = dRow as {
    airtable_is_canonical: boolean | null;
    airtable_base_id: string | null;
    airtable_voters_table_id: string | null;
  };
  if (!d.airtable_is_canonical || !d.airtable_base_id || !d.airtable_voters_table_id) {
    return NextResponse.json(
      { error: "district has no canonical Airtable base — run the upload wizard first" },
      { status: 409 },
    );
  }

  const creds = await resolveAirtableTokenForDistrict(body.district_id);
  if (!creds?.token) {
    return NextResponse.json({ error: "no airtable token" }, { status: 412 });
  }

  try {
    const summary = await runImport({
      supabase,
      districtId: body.district_id,
      baseId: d.airtable_base_id,
      tableId: d.airtable_voters_table_id,
      mapping: CANONICAL_IMPORT_MAPPING,
      airtableToken: creds.token,
      patchAirtableLatLng: true,
    });
    return NextResponse.json({ ok: true, summary });
  } catch (err) {
    const message = (err as Error).message;
    await supabase
      .from("districts")
      .update({ airtable_import_status: "error", airtable_last_error: message })
      .eq("id", body.district_id);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
