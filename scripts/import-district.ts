/**
 * Usage: tsx scripts/import-district.ts --district=sc-hd-115
 *
 * Pulls voters from the Airtable base configured in the `districts` row, geocodes
 * each unique address via Mapbox, upserts households + voters into Supabase,
 * then patches lat/lng back to Airtable. Idempotent: re-run to pick up voter
 * file updates.
 */

import { createClient } from "@supabase/supabase-js";
import { AirtableClient } from "../lib/airtable/client";
import { geocodeAddress } from "../lib/geo/mapbox";

interface Args {
  district: string;
  limit?: number;
  dryRun?: boolean;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const out: Args = { district: "" };
  for (const a of args) {
    const [k, v] = a.replace(/^--/, "").split("=");
    if (k === "district") out.district = v;
    if (k === "limit") out.limit = Number(v);
    if (k === "dry-run") out.dryRun = true;
  }
  if (!out.district) {
    console.error("Usage: tsx scripts/import-district.ts --district=<slug> [--limit=50] [--dry-run]");
    process.exit(1);
  }
  return out;
}

interface TargetVoterFields {
  VoterKey?: string;
  HHRecId?: string;
  StateVoterID?: string;
  ClientID?: string;
  FirstName?: string;
  MiddleName?: string;
  LastName?: string;
  Suffix?: string;
  PrimaryAddress1?: string;
  PrimaryUnit?: string;
  City?: string;
  State?: string;
  Zip?: string;
  Zip4?: string;
  Lat?: number;
  Lng?: number;
  Neighborhood?: string;
  HHParty?: string;
  PrimaryPhone?: string;
  ObservedParty?: string;
  OfficialParty?: string;
  CalculatedParty?: string;
  Moved?: boolean;
}

async function main() {
  const args = parseArgs();

  const supabase = createClient(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  );

  const { data: district, error: dErr } = await supabase
    .from("districts")
    .select("*")
    .eq("slug", args.district)
    .maybeSingle();
  if (dErr || !district) throw new Error(`District ${args.district} not found`);
  if (!district.airtable_base_id || !district.airtable_voters_table_id) {
    throw new Error(`District ${args.district} missing airtable_base_id or voter table id`);
  }

  console.log(`→ Importing district: ${district.name}`);
  console.log(`  Airtable base: ${district.airtable_base_id}`);
  console.log(`  Table: ${district.airtable_voters_table_id}`);

  const airtable = new AirtableClient();

  const voters: Array<{ airtableId: string; fields: TargetVoterFields }> = [];
  for await (const rec of airtable.listAll<{ id: string; fields: TargetVoterFields }>(
    district.airtable_base_id,
    district.airtable_voters_table_id,
    { pageSize: 100 },
  )) {
    voters.push({ airtableId: rec.id, fields: rec.fields });
    if (args.limit && voters.length >= args.limit) break;
  }
  console.log(`  Fetched ${voters.length} voter rows`);

  // Group by household
  const householdKey = (f: TargetVoterFields) =>
    (f.HHRecId ?? `${f.PrimaryAddress1}|${f.PrimaryUnit ?? ""}|${f.Zip ?? ""}`).trim();

  const households = new Map<
    string,
    {
      airtable_hh_rec_id: string;
      address_line1: string;
      unit: string | null;
      city: string | null;
      state: string | null;
      zip: string | null;
      zip4: string | null;
      neighborhood_id: string | null;
      household_party: string | null;
      lat: number | null;
      lng: number | null;
      member_airtable_ids: string[];
    }
  >();

  for (const v of voters) {
    const key = householdKey(v.fields);
    if (!key) continue;
    const existing = households.get(key);
    if (existing) {
      existing.member_airtable_ids.push(v.airtableId);
      continue;
    }
    households.set(key, {
      airtable_hh_rec_id: key,
      address_line1: v.fields.PrimaryAddress1 ?? "",
      unit: v.fields.PrimaryUnit ?? null,
      city: v.fields.City ?? null,
      state: v.fields.State ?? null,
      zip: v.fields.Zip ?? null,
      zip4: v.fields.Zip4 ?? null,
      neighborhood_id: v.fields.Neighborhood ?? null,
      household_party: v.fields.HHParty ?? null,
      lat: typeof v.fields.Lat === "number" ? v.fields.Lat : null,
      lng: typeof v.fields.Lng === "number" ? v.fields.Lng : null,
      member_airtable_ids: [v.airtableId],
    });
  }
  console.log(`  Grouped into ${households.size} households`);

  // Geocode any that don't already have lat/lng
  const toGeocode = [...households.values()].filter((h) => h.lat === null || h.lng === null);
  console.log(`  Geocoding ${toGeocode.length} addresses via Mapbox`);
  const geocodePatches: Array<{ id: string; fields: { Lat: number; Lng: number; GeocodedAt: string } }> = [];
  for (const h of toGeocode) {
    const addr = [h.address_line1, h.city, h.state, h.zip].filter(Boolean).join(", ");
    const result = await geocodeAddress(addr);
    if (!result) {
      console.warn(`    failed: ${addr}`);
      continue;
    }
    h.lat = result.lat;
    h.lng = result.lng;
    for (const atId of h.member_airtable_ids) {
      geocodePatches.push({
        id: atId,
        fields: { Lat: result.lat, Lng: result.lng, GeocodedAt: new Date().toISOString() },
      });
    }
  }

  if (args.dryRun) {
    console.log("  (dry run) skipping database writes");
    return;
  }

  // Upsert households
  const householdRows = [...households.values()]
    .filter((h) => h.lat !== null && h.lng !== null)
    .map((h) => ({
      district_id: district.id,
      airtable_hh_rec_id: h.airtable_hh_rec_id,
      address_line1: h.address_line1,
      unit: h.unit,
      city: h.city,
      state: h.state,
      zip: h.zip,
      zip4: h.zip4,
      neighborhood_id: h.neighborhood_id,
      household_party: h.household_party,
      lat: h.lat!,
      lng: h.lng!,
    }));

  for (const chunk of chunked(householdRows, 200)) {
    const { error } = await supabase
      .from("households")
      .upsert(chunk, { onConflict: "district_id,airtable_hh_rec_id" });
    if (error) throw error;
  }
  console.log(`  Upserted ${householdRows.length} households`);

  // Resolve household ids
  const { data: storedHH } = await supabase
    .from("households")
    .select("id, airtable_hh_rec_id")
    .eq("district_id", district.id);
  const hhIdByKey = new Map((storedHH ?? []).map((r: { id: string; airtable_hh_rec_id: string }) => [r.airtable_hh_rec_id, r.id]));

  // Upsert voters
  const voterRows = voters
    .map((v) => {
      const key = householdKey(v.fields);
      const householdId = hhIdByKey.get(key);
      if (!householdId) return null;
      return {
        district_id: district.id,
        household_id: householdId,
        airtable_voter_key: v.fields.VoterKey ?? v.airtableId,
        state_voter_id: v.fields.StateVoterID ?? null,
        client_id: v.fields.ClientID ?? null,
        first_name: v.fields.FirstName ?? null,
        middle_name: v.fields.MiddleName ?? null,
        last_name: v.fields.LastName ?? null,
        suffix: v.fields.Suffix ?? null,
        primary_phone: v.fields.PrimaryPhone ?? null,
        observed_party: v.fields.ObservedParty ?? null,
        official_party: v.fields.OfficialParty ?? null,
        calculated_party: v.fields.CalculatedParty ?? null,
        moved: v.fields.Moved ?? false,
      };
    })
    .filter(Boolean);

  for (const chunk of chunked(voterRows as object[], 200)) {
    const { error } = await supabase
      .from("voters")
      .upsert(chunk, { onConflict: "district_id,airtable_voter_key" });
    if (error) throw error;
  }
  console.log(`  Upserted ${voterRows.length} voters`);

  // Patch Airtable with lat/lng for newly geocoded rows
  if (geocodePatches.length > 0) {
    console.log(`  Writing lat/lng back to Airtable for ${geocodePatches.length} voters`);
    await airtable.batchUpdate(
      district.airtable_base_id,
      district.airtable_voters_table_id,
      geocodePatches,
    );
  }

  console.log("✅ import complete");
}

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function chunked<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
