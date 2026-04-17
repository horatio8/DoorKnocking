// Mapping-driven import. Pulls every row from the configured Airtable table,
// translates each row through the saved field-mapping, geocodes any missing
// addresses, and upserts households + voters into Supabase.

import type { SupabaseClient } from "@supabase/supabase-js";
import { AirtableClient, type AirtableRecord } from "./client";
import { geocodeAddress } from "@/lib/geo/mapbox";
import type { FieldMapping } from "./mapping";

export interface ImportSummary {
  records_fetched: number;
  households_upserted: number;
  voters_upserted: number;
  geocoded: number;
  geocode_failed: number;
  airtable_patched: number;
  duration_ms: number;
}

export interface ImportArgs {
  supabase: SupabaseClient;
  districtId: string;
  baseId: string;
  tableId: string;
  mapping: FieldMapping;
  limit?: number;
  patchAirtableLatLng?: boolean;
}

function pickValue<T = unknown>(
  fields: Record<string, unknown>,
  airtableKey: string | null | undefined,
): T | undefined {
  if (!airtableKey) return undefined;
  const v = fields[airtableKey];
  return v === undefined || v === null || v === "" ? undefined : (v as T);
}

function asString(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  if (Array.isArray(v)) return v.length > 0 ? String(v[0]) : null;
  return String(v);
}

function asNumber(v: unknown): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function asBool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return /^(true|yes|y|1|t)$/i.test(v.trim());
  return Boolean(v);
}

// Translate one Airtable record into the platform's household + voter payload.
export function mapRecord(
  fields: Record<string, unknown>,
  mapping: FieldMapping,
  airtableId: string,
) {
  const voterKey =
    asString(pickValue(fields, mapping.airtable_voter_key)) ?? airtableId;

  const address = asString(pickValue(fields, mapping.address_line1)) ?? "";
  const unit = asString(pickValue(fields, mapping.unit));
  const zip = asString(pickValue(fields, mapping.zip)) ?? "";
  const householdRecId =
    asString(pickValue(fields, mapping.household_rec_id)) ??
    `${address}|${unit ?? ""}|${zip}`.toLowerCase();

  return {
    voterKey,
    householdRecId,
    voter: {
      airtable_voter_key: voterKey,
      state_voter_id: asString(pickValue(fields, mapping.state_voter_id)),
      client_id: asString(pickValue(fields, mapping.client_id)),
      first_name: asString(pickValue(fields, mapping.first_name)),
      middle_name: asString(pickValue(fields, mapping.middle_name)),
      last_name: asString(pickValue(fields, mapping.last_name)),
      suffix: asString(pickValue(fields, mapping.suffix)),
      primary_phone: asString(pickValue(fields, mapping.primary_phone)),
      observed_party: asString(pickValue(fields, mapping.observed_party)),
      official_party: asString(pickValue(fields, mapping.official_party)),
      calculated_party: asString(pickValue(fields, mapping.calculated_party)),
      moved: mapping.moved ? asBool(pickValue(fields, mapping.moved)) : false,
    },
    household: {
      airtable_hh_rec_id: householdRecId,
      address_line1: address,
      city: asString(pickValue(fields, mapping.city)),
      state: asString(pickValue(fields, mapping.state)),
      zip,
      zip4: asString(pickValue(fields, mapping.zip4)),
      unit,
      lat: asNumber(pickValue(fields, mapping.lat)),
      lng: asNumber(pickValue(fields, mapping.lng)),
      neighborhood_id: asString(pickValue(fields, mapping.neighborhood_id)),
      household_party: asString(pickValue(fields, mapping.household_party)),
    },
    airtableId,
  };
}

export async function runImport({
  supabase,
  districtId,
  baseId,
  tableId,
  mapping,
  limit,
  patchAirtableLatLng = true,
}: ImportArgs): Promise<ImportSummary> {
  const started = Date.now();
  const airtable = new AirtableClient();

  // Mark district as importing
  await supabase
    .from("districts")
    .update({ airtable_import_status: "importing", airtable_last_error: null })
    .eq("id", districtId);

  const records: AirtableRecord[] = [];
  for await (const rec of airtable.listAll<AirtableRecord>(baseId, tableId, { pageSize: 100 })) {
    records.push(rec);
    if (limit && records.length >= limit) break;
  }

  // Group by household
  const householdsByKey = new Map<
    string,
    {
      payload: ReturnType<typeof mapRecord>["household"];
      memberAirtableIds: string[];
    }
  >();
  const voters: Array<ReturnType<typeof mapRecord>["voter"] & { householdRecId: string }> = [];

  for (const rec of records) {
    const mapped = mapRecord(rec.fields ?? {}, mapping, rec.id);
    if (!mapped.household.address_line1) continue;
    const existing = householdsByKey.get(mapped.householdRecId);
    if (existing) {
      existing.memberAirtableIds.push(rec.id);
    } else {
      householdsByKey.set(mapped.householdRecId, {
        payload: mapped.household,
        memberAirtableIds: [rec.id],
      });
    }
    voters.push({ ...mapped.voter, householdRecId: mapped.householdRecId });
  }

  // Geocode any households missing lat/lng
  const geocodePatches: Array<{ id: string; fields: { Lat: number; Lng: number; GeocodedAt: string } }> = [];
  let geocoded = 0;
  let geocode_failed = 0;
  for (const [, h] of householdsByKey) {
    if (h.payload.lat !== null && h.payload.lng !== null) continue;
    const addr = [h.payload.address_line1, h.payload.city, h.payload.state, h.payload.zip]
      .filter(Boolean)
      .join(", ");
    const result = await geocodeAddress(addr);
    if (!result) {
      geocode_failed++;
      continue;
    }
    h.payload.lat = result.lat;
    h.payload.lng = result.lng;
    geocoded++;
    if (patchAirtableLatLng) {
      for (const id of h.memberAirtableIds) {
        geocodePatches.push({
          id,
          fields: { Lat: result.lat, Lng: result.lng, GeocodedAt: new Date().toISOString() },
        });
      }
    }
  }

  // Upsert households (skip ones we couldn't geocode — they're useless on the map)
  const householdRows = [...householdsByKey.values()]
    .filter((h) => h.payload.lat !== null && h.payload.lng !== null)
    .map((h) => ({ ...h.payload, district_id: districtId }));

  for (const batch of chunk(householdRows, 200)) {
    const { error } = await supabase
      .from("households")
      .upsert(batch, { onConflict: "district_id,airtable_hh_rec_id" });
    if (error) throw new Error(`households upsert failed: ${error.message}`);
  }

  // Resolve household ids
  const { data: storedHH, error: storedErr } = await supabase
    .from("households")
    .select("id, airtable_hh_rec_id")
    .eq("district_id", districtId);
  if (storedErr) throw new Error(`households read failed: ${storedErr.message}`);
  const idByKey = new Map<string, string>();
  for (const r of storedHH ?? []) {
    idByKey.set((r as { airtable_hh_rec_id: string }).airtable_hh_rec_id, (r as { id: string }).id);
  }

  // Upsert voters
  const voterRows = voters
    .map((v) => {
      const householdId = idByKey.get(v.householdRecId);
      if (!householdId) return null;
      const { householdRecId: _hr, ...rest } = v;
      return { ...rest, district_id: districtId, household_id: householdId };
    })
    .filter(Boolean) as object[];

  for (const batch of chunk(voterRows, 200)) {
    const { error } = await supabase
      .from("voters")
      .upsert(batch, { onConflict: "district_id,airtable_voter_key" });
    if (error) throw new Error(`voters upsert failed: ${error.message}`);
  }

  // Patch Airtable with geocoded lat/lng (best-effort)
  let airtable_patched = 0;
  if (geocodePatches.length > 0 && patchAirtableLatLng) {
    try {
      await airtable.batchUpdate(baseId, tableId, geocodePatches);
      airtable_patched = geocodePatches.length;
    } catch (err) {
      console.warn("Airtable lat/lng patch failed:", (err as Error).message);
    }
  }

  const summary: ImportSummary = {
    records_fetched: records.length,
    households_upserted: householdRows.length,
    voters_upserted: voterRows.length,
    geocoded,
    geocode_failed,
    airtable_patched,
    duration_ms: Date.now() - started,
  };

  await supabase
    .from("districts")
    .update({
      airtable_import_status: "ready",
      airtable_last_imported_at: new Date().toISOString(),
      airtable_last_import_summary: summary,
      airtable_last_error: null,
    })
    .eq("id", districtId);

  return summary;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
