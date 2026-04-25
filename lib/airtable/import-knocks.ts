// CSV-driven knock-history import. Optional add-on to the bulk-file
// upload flow: if the admin maps a knock_status column (and
// optionally knocked_at / knocker_email / knock_notes), we create
// one knock_events row per CSV row that has a recognised status.
//
// Idempotent: client_event_id is deterministic on
// (import_file_id, voter_key, knocked_at) so re-uploading the same
// file doesn't double-insert. The status flows through the existing
// `status_from_knock` trigger which updates voters.current_status +
// households.status — map pin colours update for free.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { FieldMapping } from "./mapping";

// `not_knocked` is intentionally NOT a valid knock_events.status
// (it represents the *absence* of a knock — the default state on
// new households), so any rows tagged with it are skipped without
// counting as an error.
const VALID_KNOCK_STATUSES = new Set([
  "no_answer",
  "come_back_later",
  "refused",
  "contacted",
  "wrong_address",
]);

// Accept variants that admins commonly type in spreadsheets so they
// don't have to learn the enum values.
const STATUS_ALIASES: Record<string, string> = {
  "no answer": "no_answer",
  "no-answer": "no_answer",
  "noanswer": "no_answer",
  "come back": "come_back_later",
  "come back later": "come_back_later",
  "callback": "come_back_later",
  "refuse": "refused",
  "refused": "refused",
  "rejected": "refused",
  "contacted": "contacted",
  "spoke": "contacted",
  "talked": "contacted",
  "home": "contacted",
  "wrong address": "wrong_address",
  "wrong person": "wrong_address",
  "wrong": "wrong_address",
  "moved": "wrong_address",
  "not knocked": "skip",
  "not_knocked": "skip",
  "skip": "skip",
};

function normaliseStatus(raw: string): string | null {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return null;
  if (VALID_KNOCK_STATUSES.has(trimmed)) return trimmed;
  const alias = STATUS_ALIASES[trimmed];
  if (alias === "skip") return null;
  if (alias && VALID_KNOCK_STATUSES.has(alias)) return alias;
  return null;
}

// Lenient date parsing so admins can use any spreadsheet-friendly
// format. Falls back to "now" when missing/unparseable. Returns an
// ISO string.
function normaliseKnockedAt(raw: string | null | undefined, fallback: Date): string {
  if (!raw) return fallback.toISOString();
  const trimmed = raw.trim();
  if (!trimmed) return fallback.toISOString();
  // Try Date.parse first (handles ISO + most US formats).
  const parsed = Date.parse(trimmed);
  if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  return fallback.toISOString();
}

export interface CsvKnockRow {
  voterKey: string;
  rawStatus: string;
  rawKnockedAt: string | null;
  rawKnockerEmail: string | null;
  rawNotes: string | null;
}

export interface ImportKnocksArgs {
  supabase: SupabaseClient;
  importFileId: string;
  districtId: string;
  // Admin who uploaded the file. Used as the default knocker when
  // a row's knocker_email is missing or doesn't match a real user.
  defaultKnockerId: string | null;
  // The mapping for this file. Used to detect whether the knock
  // columns are wired up at all — we early-out when there's no
  // knock_status column mapped.
  mapping: FieldMapping;
  // Parsed file rows (raw, header-keyed). The caller has already
  // run the file through parseFile; we just pluck the columns we
  // need based on `mapping`.
  rows: Array<Record<string, string>>;
}

export interface ImportKnocksResult {
  attempted: number;
  inserted: number;
  skippedNoStatus: number;
  skippedUnknownStatus: number;
  skippedNoVoter: number;
  failed: number;
  errors: string[];
  // Top distinct status values that didn't normalise, with row
  // counts. Surfaced in import_jobs.error_detail so the admin can
  // see *what* their CSV had instead of guessing — e.g.
  //   [{value: "Knocked", count: 156}, {value: "Not Home", count: 42}]
  // tells them exactly which aliases to add (or which CSV values
  // to rewrite). Capped to keep the JSON small.
  unknownStatusSamples: Array<{ value: string; count: number }>;
  // Voter keys that had a recognised status but couldn't be matched
  // to a Supabase voter row (probably means the airtable_voter_key
  // mapping is wrong, or the voter wasn't in the same CSV). First
  // 20 only.
  unmatchedVoterKeySamples: string[];
}

const SAMPLE_CAP = 20;

export async function importKnocksFromRows(
  args: ImportKnocksArgs,
): Promise<ImportKnocksResult> {
  const result: ImportKnocksResult = {
    attempted: 0,
    inserted: 0,
    skippedNoStatus: 0,
    skippedUnknownStatus: 0,
    skippedNoVoter: 0,
    failed: 0,
    errors: [],
    unknownStatusSamples: [],
    unmatchedVoterKeySamples: [],
  };
  const unknownCounts = new Map<string, number>();
  const unmatchedKeys: string[] = [];

  const statusCol = args.mapping["knock_status"];
  if (!statusCol) {
    // No knock_status mapping — admin didn't intend to import knock
    // history. No-op.
    return result;
  }

  const voterKeyCol = args.mapping["airtable_voter_key"];
  if (!voterKeyCol) {
    // Without a voter key we can't resolve the row to a voter id.
    // Required field anyway, but defensive.
    result.errors.push("airtable_voter_key column not mapped — cannot link knocks to voters");
    return result;
  }

  const knockedAtCol = args.mapping["knocked_at"];
  const knockerEmailCol = args.mapping["knocker_email"];
  const notesCol = args.mapping["knock_notes"];
  const fallbackTime = new Date();

  // Pre-compute the candidate set so we can do all DB lookups in
  // batch instead of per-row.
  interface Pending {
    voterKey: string;
    status: string;
    knockedAt: string;
    knockerEmail: string | null;
    notes: string | null;
  }
  const pending: Pending[] = [];
  for (const row of args.rows) {
    const voterKey = (row[voterKeyCol] ?? "").trim();
    if (!voterKey) continue;
    const rawStatus = (row[statusCol] ?? "").trim();
    if (!rawStatus) {
      result.skippedNoStatus++;
      continue;
    }
    const status = normaliseStatus(rawStatus);
    if (!status) {
      result.skippedUnknownStatus++;
      // Track distinct unknown values so the admin sees exactly
      // which strings their CSV used. Trim + lowercase the key to
      // group "knocked" / "Knocked" / " knocked " together; preserve
      // the raw value as a sample so it reads naturally.
      const key = rawStatus.trim().toLowerCase();
      unknownCounts.set(key, (unknownCounts.get(key) ?? 0) + 1);
      continue;
    }
    const knockedAt = normaliseKnockedAt(
      knockedAtCol ? row[knockedAtCol] : null,
      fallbackTime,
    );
    const knockerEmail =
      knockerEmailCol && row[knockerEmailCol]?.trim()
        ? row[knockerEmailCol].trim().toLowerCase()
        : null;
    const notes = notesCol ? row[notesCol]?.trim() ?? null : null;
    pending.push({ voterKey, status, knockedAt, knockerEmail, notes: notes || null });
  }
  result.attempted = pending.length;
  // Materialise samples now even if we early-return: an admin who
  // mapped knock_status to a column that's entirely unrecognised
  // values needs to see those values to fix the next upload.
  result.unknownStatusSamples = topSamples(unknownCounts);
  if (pending.length === 0) {
    result.unmatchedVoterKeySamples = unmatchedKeys.slice(0, SAMPLE_CAP);
    return result;
  }

  // Resolve voter id + household id by airtable_voter_key in one
  // shot. This relies on runImport having already upserted the
  // voters / households for this district — we run after it.
  const uniqueKeys = Array.from(new Set(pending.map((p) => p.voterKey)));
  const voterByKey = new Map<string, { id: string; household_id: string }>();
  const CHUNK = 500;
  for (let i = 0; i < uniqueKeys.length; i += CHUNK) {
    const slice = uniqueKeys.slice(i, i + CHUNK);
    const { data: rows } = await args.supabase
      .from("voters")
      .select("id, household_id, airtable_voter_key")
      .eq("district_id", args.districtId)
      .in("airtable_voter_key", slice);
    for (const r of (rows ?? []) as Array<{
      id: string;
      household_id: string;
      airtable_voter_key: string;
    }>) {
      voterByKey.set(r.airtable_voter_key, { id: r.id, household_id: r.household_id });
    }
  }

  // Resolve knocker emails in one shot.
  const uniqueEmails = Array.from(
    new Set(pending.map((p) => p.knockerEmail).filter((e): e is string => Boolean(e))),
  );
  const userIdByEmail = new Map<string, string>();
  if (uniqueEmails.length > 0) {
    const { data: users } = await args.supabase
      .from("users")
      .select("id, email")
      .in("email", uniqueEmails);
    for (const u of (users ?? []) as Array<{ id: string; email: string }>) {
      userIdByEmail.set(u.email.toLowerCase(), u.id);
    }
  }

  // Build payloads. client_event_id is deterministic so re-uploading
  // the same file deduplicates instead of duplicating.
  const payloads: Array<Record<string, unknown>> = [];
  for (const p of pending) {
    const voter = voterByKey.get(p.voterKey);
    if (!voter) {
      result.skippedNoVoter++;
      if (unmatchedKeys.length < SAMPLE_CAP) unmatchedKeys.push(p.voterKey);
      continue;
    }
    const knockerId =
      (p.knockerEmail && userIdByEmail.get(p.knockerEmail)) ||
      args.defaultKnockerId;
    if (!knockerId) {
      result.failed++;
      result.errors.push(
        `voter ${p.voterKey}: no knocker (knocker_email "${p.knockerEmail ?? ""}" not found and no default uploader on file)`,
      );
      continue;
    }
    const clientEventId = `csv-import:${args.importFileId}:${p.voterKey}:${p.knockedAt}`;
    payloads.push({
      client_event_id: clientEventId,
      household_id: voter.household_id,
      voter_id: voter.id,
      user_id: knockerId,
      walkbook_id: null,
      status: p.status,
      knocked_at: p.knockedAt,
      duration_seconds: null,
      notes: p.notes,
      survey_id: null,
    });
  }
  if (payloads.length === 0) return result;

  // Batched upsert keyed on client_event_id. onConflict updates the
  // existing row so corrections in a re-uploaded file flow through.
  for (let i = 0; i < payloads.length; i += 200) {
    const batch = payloads.slice(i, i + 200);
    const { data, error } = await args.supabase
      .from("knock_events")
      .upsert(batch, { onConflict: "client_event_id" })
      .select("id");
    if (error) {
      result.failed += batch.length;
      result.errors.push(`knock_events upsert (rows ${i}-${i + batch.length}): ${error.message}`);
      console.error("[csv:import-knocks] upsert failed", {
        importFileId: args.importFileId,
        rangeStart: i,
        rangeEnd: i + batch.length,
        message: error.message,
      });
      continue;
    }
    result.inserted += data?.length ?? batch.length;
  }
  result.unmatchedVoterKeySamples = unmatchedKeys.slice(0, SAMPLE_CAP);
  console.info("[csv:import-knocks] done", {
    importFileId: args.importFileId,
    districtId: args.districtId,
    ...result,
  });
  return result;
}

// Top-N entries from a value→count map, sorted by count desc, ties
// broken alphabetically. Lets the admin see "Knocked: 156, Not Home:
// 42, Refused: 15…" and act on the long tail without us shipping
// kilobytes of jsonb in the import_jobs row.
function topSamples(
  counts: Map<string, number>,
): Array<{ value: string; count: number }> {
  return Array.from(counts.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
    .slice(0, SAMPLE_CAP);
}
