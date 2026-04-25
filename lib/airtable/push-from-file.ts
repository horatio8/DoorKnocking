// Streams an uploaded CSV/XLSX into the canonical Airtable base and
// then calls the existing `runImport` so Supabase catches up too. One
// code path: Airtable is always the source of truth for the voters +
// households rows that end up in the database.

import type { SupabaseClient } from "@supabase/supabase-js";
import { AirtableClient } from "./client";
import { VOTER_FIELDS, HOUSEHOLD_FIELDS } from "./schema";
import type { FieldMapping } from "./mapping";
import { parseFile, detectFormat } from "./file-parser";
import { householdKey } from "@/lib/addresses/normalize";
import { runImport } from "./import";
import { importKnocksFromRows, type ImportKnocksResult } from "./import-knocks";

export interface PushFromFileArgs {
  supabase: SupabaseClient;
  districtId: string;
  importFileId: string;
  baseId: string;
  votersTableId: string;
  householdsTableId: string;
  mapping: FieldMapping;
  storagePath: string;
  originalFilename: string;
  airtableToken: string;
  // Progress reporter — called at the transition between phases so a
  // caller running inside the cron worker can patch the import_jobs
  // row without knowing anything about our internals.
  onProgress?: (event: PushProgressEvent) => Promise<void>;
}

export type PushProgressEvent =
  | { phase: "parsed"; rowsTotal: number }
  | { phase: "pushing" }
  | { phase: "pushed"; householdsPushed: number; votersPushed: number }
  | { phase: "importing" }
  | { phase: "imported"; summary: Awaited<ReturnType<typeof runImport>> }
  | { phase: "knocks_imported"; result: ImportKnocksResult };

export interface PushResult {
  parsed_rows: number;
  households_pushed: number;
  voters_pushed: number;
  import_summary: Awaited<ReturnType<typeof runImport>>;
  knocks_import?: ImportKnocksResult;
}

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

function asString(v: unknown): string {
  if (v === undefined || v === null) return "";
  return String(v).trim();
}

export async function pushFromFile(args: PushFromFileArgs): Promise<PushResult> {
  const { supabase, districtId, importFileId, baseId, votersTableId, householdsTableId, mapping, storagePath, originalFilename, airtableToken } = args;

  // 1. Read the staged file out of Supabase Storage.
  const { data: fileBlob, error: dlErr } = await supabase.storage
    .from("import-files")
    .download(storagePath);
  if (dlErr || !fileBlob) {
    throw new Error(`could not read staged file: ${dlErr?.message ?? "not found"}`);
  }
  const buffer = Buffer.from(await fileBlob.arrayBuffer());
  const format = detectFormat(originalFilename, null);
  if (!format) throw new Error("unsupported file format");
  const parsed = parseFile(buffer, format);

  // 2. Apply the mapping → rows keyed by canonical platform keys.
  interface MappedRow {
    voterKey: string;
    householdKey: string;
    voterFields: Record<string, unknown>;
    householdFields: Record<string, unknown>;
  }
  const mapped: MappedRow[] = [];
  const householdByKey = new Map<string, Record<string, unknown>>();

  for (const row of parsed.rows) {
    const pick = (key: string) => {
      const col = mapping[key];
      return col ? asString(row[col]) : "";
    };

    const address = pick("address_line1");
    const unit = pick("unit");
    const zip = pick("zip");
    if (!address) continue;

    // Always derive the household key from the normalised address.
    // Earlier we honoured the source CSV's `household_rec_id` column
    // when mapped, but voter files are commonly denormalised with one
    // row per knock / phone / outreach event, and `HHRecId` ends up
    // unique per row instead of per physical address. Result: 4,260
    // "households" for 1,135 voters — one per CSV row instead of one
    // per address. The address-derived key gives the semantic the app
    // assumes ("one household = one physical dwelling"). Source HHRecId
    // is ignored for dedupe; if you need a stable external id per
    // household, derive it later from the canonical Airtable record id.
    const hhKey = householdKey({ address, unit, zip });
    const voterKey = pick("airtable_voter_key") ||
      `${hhKey}::${pick("first_name")}-${pick("last_name")}`.toLowerCase();

    const voterFields: Record<string, unknown> = {
      [VOTER_FIELDS.voterKey]: voterKey,
      [VOTER_FIELDS.firstName]: pick("first_name") || null,
      [VOTER_FIELDS.middleName]: pick("middle_name") || null,
      [VOTER_FIELDS.lastName]: pick("last_name") || null,
      [VOTER_FIELDS.suffix]: pick("suffix") || null,
      [VOTER_FIELDS.address]: address,
      [VOTER_FIELDS.unit]: unit || null,
      [VOTER_FIELDS.city]: pick("city") || null,
      [VOTER_FIELDS.state]: pick("state") || null,
      [VOTER_FIELDS.zip]: zip || null,
      [VOTER_FIELDS.phone]: pick("primary_phone") || null,
      [VOTER_FIELDS.party]: pick("official_party") || null,
      // Linked field resolved by Airtable via typecast on the primary
      // field of the Households table.
      [VOTER_FIELDS.household]: [hhKey],
    };

    const householdFields: Record<string, unknown> = {
      [HOUSEHOLD_FIELDS.householdKey]: hhKey,
      [HOUSEHOLD_FIELDS.address]: address,
      [HOUSEHOLD_FIELDS.unit]: unit || null,
      [HOUSEHOLD_FIELDS.city]: pick("city") || null,
      [HOUSEHOLD_FIELDS.state]: pick("state") || null,
      [HOUSEHOLD_FIELDS.zip]: zip || null,
    };

    if (!householdByKey.has(hhKey)) {
      householdByKey.set(hhKey, householdFields);
    }
    mapped.push({ voterKey, householdKey: hhKey, voterFields, householdFields });
  }

  await args.onProgress?.({ phase: "parsed", rowsTotal: parsed.rowCount });

  // 3. Push households first so linked-record field on voters resolves.
  await args.onProgress?.({ phase: "pushing" });
  const airtable = new AirtableClient(airtableToken);
  const householdRecords = [...householdByKey.values()].map((fields) => ({ fields }));
  const createdHouseholds = await airtable.batchCreate(baseId, householdsTableId, householdRecords);

  // 4. Push voters (typecast=true lets the Household field take the
  // primary field string value and resolve it to a rec id).
  //
  // Dedupe by voterKey first. CSVs are commonly denormalised — one
  // row per knock / per phone / per outreach event — so the same
  // voter appears N times. Without dedupe we used to push N copies
  // to Airtable and let the Supabase upsert collapse them, leaving
  // Airtable's voters table N× larger than the actual unique-people
  // count. Last-write-wins for any field collisions, which matches
  // what runImport does on the Supabase side via upsert.
  // Knock-import (lib/airtable/import-knocks.ts) reads from the raw
  // parsed.rows, so per-row knock data is unaffected by this dedupe.
  const voterByKey = new Map<string, (typeof mapped)[number]>();
  for (const m of mapped) voterByKey.set(m.voterKey, m);
  const voterRecords = [...voterByKey.values()].map((m) => ({ fields: m.voterFields }));
  const createdVoters = await airtable.batchCreate(baseId, votersTableId, voterRecords);

  // 5. Update import_files row so the admin sees progress.
  await supabase
    .from("import_files")
    .update({
      status: "pushed",
      pushed_at: new Date().toISOString(),
    })
    .eq("id", importFileId);
  await args.onProgress?.({
    phase: "pushed",
    householdsPushed: createdHouseholds.length,
    votersPushed: createdVoters.length,
  });

  // 6. Pull everything back into Supabase via the existing importer.
  // The canonical schema is an identity map, so no per-district mapping
  // work is needed.
  await args.onProgress?.({ phase: "importing" });
  const importSummary = await runImport({
    supabase,
    districtId,
    baseId,
    tableId: votersTableId,
    mapping: CANONICAL_IMPORT_MAPPING,
    airtableToken,
    patchAirtableLatLng: true,
  });

  await supabase
    .from("import_files")
    .update({ status: "imported", imported_at: new Date().toISOString() })
    .eq("id", importFileId);
  await args.onProgress?.({ phase: "imported", summary: importSummary });

  // 7. Optional knock-history ingest. Runs only when the admin
  // mapped a knock_status column. We pass the raw parsed rows
  // (header-keyed) so the helper can pluck whichever knock columns
  // were mapped. defaultKnockerId comes from the file's uploaded_by
  // so unmatched knocker_email values fall back to "the admin who
  // uploaded this CSV", which is always a real user.
  let knocksImport: ImportKnocksResult | undefined;
  if (mapping["knock_status"]) {
    const { data: fileRow } = await supabase
      .from("import_files")
      .select("uploaded_by")
      .eq("id", importFileId)
      .maybeSingle();
    const defaultKnockerId =
      (fileRow as { uploaded_by: string | null } | null)?.uploaded_by ?? null;
    knocksImport = await importKnocksFromRows({
      supabase,
      importFileId,
      districtId,
      defaultKnockerId,
      mapping,
      rows: parsed.rows,
    });
    await args.onProgress?.({ phase: "knocks_imported", result: knocksImport });
  }

  return {
    parsed_rows: parsed.rowCount,
    households_pushed: createdHouseholds.length,
    voters_pushed: createdVoters.length,
    import_summary: importSummary,
    knocks_import: knocksImport,
  };
}
