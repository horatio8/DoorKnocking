// Mirrors a single knock_events row into the canonical Airtable
// Knocks table, then updates the linked Voter's denormalised
// "Last *" columns + the Household's "Last Status" so admins reading
// Airtable can sort/filter without joining.
//
// Designed to be idempotent: the cron worker
// (app/api/cron/mirror-airtable/route.ts) calls this once per
// unsynced row per tick. Soft-failures (district not provisioned,
// no token, voter without airtable_voter_key) return `skipped` —
// the worker still stamps airtable_synced_at so the row doesn't
// re-queue every tick. Hard failures throw and the worker leaves
// the row pending for the next tick.

import type { SupabaseClient } from "@supabase/supabase-js";
import { AirtableClient } from "./client";
import { resolveAirtableTokenForDistrict } from "./credentials";
import {
  KNOCK_FIELDS,
  VOTER_FIELDS,
  HOUSEHOLD_FIELDS,
} from "./schema";

export interface MirrorKnockArgs {
  supabase: SupabaseClient;
  knockEventId: string;
}

export type MirrorKnockOutcome =
  | { status: "ok"; knockEventId: string; airtableRecId: string }
  | { status: "skipped"; knockEventId: string; reason: string }
  | { status: "error"; knockEventId: string; reason: string };

interface KnockRow {
  id: string;
  household_id: string;
  voter_id: string | null;
  user_id: string;
  status: string;
  knocked_at: string;
  notes: string | null;
  survey_id: string | null;
  client_event_id: string | null;
}

interface VoterRow {
  id: string;
  district_id: string;
  airtable_voter_key: string | null;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
}

interface HouseholdRow {
  id: string;
  airtable_hh_rec_id: string | null;
  status: string | null;
}

interface DistrictRow {
  id: string;
  airtable_is_canonical: boolean | null;
  airtable_base_id: string | null;
  airtable_knocks_table_id: string | null;
  airtable_voters_table_id: string | null;
  airtable_households_table_id: string | null;
}

interface UserRow {
  id: string;
  full_name: string | null;
  email: string;
}

interface SurveyRow {
  id: string;
  name: string;
}

export async function mirrorKnockToAirtable(
  args: MirrorKnockArgs,
): Promise<MirrorKnockOutcome> {
  const { supabase, knockEventId } = args;

  const { data: knockRow } = await supabase
    .from("knock_events")
    .select(
      "id, household_id, voter_id, user_id, status, knocked_at, notes, survey_id, client_event_id",
    )
    .eq("id", knockEventId)
    .maybeSingle();
  const knock = knockRow as KnockRow | null;
  if (!knock) {
    return { status: "skipped", knockEventId, reason: "knock_event not found" };
  }

  // Voter is the routing key for nearly every Airtable lookup
  // (linked record on the Knock row, district lookup for the base
  // ids, "Last *" patch on the Voters table).
  if (!knock.voter_id) {
    return {
      status: "skipped",
      knockEventId,
      reason: "knock has no voter_id (no_answer at the household level)",
    };
  }
  const { data: voterRow } = await supabase
    .from("voters")
    .select("id, district_id, airtable_voter_key, display_name, first_name, last_name")
    .eq("id", knock.voter_id)
    .maybeSingle();
  const voter = voterRow as VoterRow | null;
  if (!voter) {
    return { status: "skipped", knockEventId, reason: "voter row gone" };
  }
  if (!voter.airtable_voter_key) {
    return {
      status: "skipped",
      knockEventId,
      reason: "voter missing airtable_voter_key — cannot link",
    };
  }

  const { data: districtRow } = await supabase
    .from("districts")
    .select(
      "id, airtable_is_canonical, airtable_base_id, airtable_knocks_table_id, airtable_voters_table_id, airtable_households_table_id",
    )
    .eq("id", voter.district_id)
    .maybeSingle();
  const district = districtRow as DistrictRow | null;
  if (
    !district?.airtable_is_canonical ||
    !district.airtable_base_id ||
    !district.airtable_knocks_table_id
  ) {
    return {
      status: "skipped",
      knockEventId,
      reason: "district has no canonical Airtable Knocks table",
    };
  }

  const creds = await resolveAirtableTokenForDistrict(district.id);
  if (!creds?.token) {
    return {
      status: "skipped",
      knockEventId,
      reason: "no airtable token for district",
    };
  }

  // Knocker name — fall back to email when the user has no
  // full_name (admins seeded via batch invite often skip it).
  const { data: userRow } = await supabase
    .from("users")
    .select("id, full_name, email")
    .eq("id", knock.user_id)
    .maybeSingle();
  const user = userRow as UserRow | null;
  const knockerLabel = user?.full_name?.trim() || user?.email || knock.user_id;

  // Survey name (optional) + per-question response appendix folded
  // into the Notes field. The canonical schema doesn't model survey
  // answers as a separate Airtable table, so we surface them as a
  // human-readable bullet list under the Notes column. Future work
  // can promote this to its own table.
  let surveyName: string | null = null;
  if (knock.survey_id) {
    const { data: surveyRow } = await supabase
      .from("surveys")
      .select("id, name")
      .eq("id", knock.survey_id)
      .maybeSingle();
    surveyName = (surveyRow as SurveyRow | null)?.name ?? null;
  }

  let answersAppendix = "";
  if (knock.survey_id) {
    const { data: respRows } = await supabase
      .from("survey_responses")
      .select("question_id, answer, survey_questions(question_text)")
      .eq("knock_event_id", knock.id);
    const responses = (respRows ?? []) as Array<{
      question_id: string;
      answer: unknown;
      survey_questions:
        | { question_text: string }
        | Array<{ question_text: string }>
        | null;
    }>;
    if (responses.length > 0) {
      const lines = responses.map((r) => {
        const q = Array.isArray(r.survey_questions)
          ? r.survey_questions[0]
          : r.survey_questions;
        const qText = q?.question_text ?? r.question_id.slice(0, 8);
        return `Q: ${qText}\nA: ${formatAnswer(r.answer)}`;
      });
      answersAppendix = `\n\n--- Survey responses ---\n${lines.join("\n\n")}`;
    }
  }

  const notesField = [knock.notes ?? "", answersAppendix]
    .filter((s) => s.trim().length > 0)
    .join("")
    .slice(0, 90_000); // Airtable long-text safety cap

  const airtable = new AirtableClient(creds.token);

  // Insert into the Knocks table. Voter is a linked-record field —
  // typecast=true (set on the AirtableClient batch* helpers) lets
  // Airtable resolve the primary-field string (Voter Key) to a
  // record id without us pre-fetching the rec id.
  const knockFields: Record<string, unknown> = {
    [KNOCK_FIELDS.knockId]: knock.client_event_id ?? knock.id,
    [KNOCK_FIELDS.voter]: [voter.airtable_voter_key],
    [KNOCK_FIELDS.status]: knock.status,
    [KNOCK_FIELDS.knockedAt]: knock.knocked_at,
    [KNOCK_FIELDS.notes]: notesField || null,
    [KNOCK_FIELDS.knocker]: knockerLabel,
  };
  if (surveyName) {
    knockFields[KNOCK_FIELDS.survey] = surveyName;
  }

  const created = await airtable.batchCreate(
    district.airtable_base_id,
    district.airtable_knocks_table_id,
    [{ fields: knockFields }],
  );
  const airtableRecId = created[0]?.id ?? null;
  if (!airtableRecId) {
    throw new Error("Airtable returned no record id for the Knock insert");
  }

  // Update the linked Voter's denormalised "Last *" columns so the
  // Voters grid in Airtable can sort by knock recency without
  // joining to Knocks. Best-effort — failures here don't roll back
  // the Knock insert.
  if (district.airtable_voters_table_id) {
    try {
      const voterRecId = await findVoterRecId(
        airtable,
        district.airtable_base_id,
        district.airtable_voters_table_id,
        voter.airtable_voter_key,
      );
      if (voterRecId) {
        await airtable.batchUpdate(
          district.airtable_base_id,
          district.airtable_voters_table_id,
          [
            {
              id: voterRecId,
              fields: {
                [VOTER_FIELDS.lastStatus]: knock.status,
                [VOTER_FIELDS.lastKnockedAt]: knock.knocked_at,
                [VOTER_FIELDS.lastNotes]: knock.notes ?? null,
                [VOTER_FIELDS.lastSurvey]: surveyName ?? null,
              },
            },
          ],
        );
      }
    } catch (err) {
      console.warn("[mirror-knock] voter Last_* update failed", {
        knockEventId,
        message: (err as Error).message,
      });
    }
  }

  // Update the Household's "Last Status" + "Last Knocked At". Same
  // best-effort posture.
  if (district.airtable_households_table_id) {
    try {
      const { data: hhRow } = await supabase
        .from("households")
        .select("id, airtable_hh_rec_id, status")
        .eq("id", knock.household_id)
        .maybeSingle();
      const hh = hhRow as HouseholdRow | null;
      if (hh?.airtable_hh_rec_id) {
        const hhRecId = await findHouseholdRecId(
          airtable,
          district.airtable_base_id,
          district.airtable_households_table_id,
          hh.airtable_hh_rec_id,
        );
        if (hhRecId) {
          await airtable.batchUpdate(
            district.airtable_base_id,
            district.airtable_households_table_id,
            [
              {
                id: hhRecId,
                fields: {
                  [HOUSEHOLD_FIELDS.lastStatus]: knock.status,
                  [HOUSEHOLD_FIELDS.lastKnockedAt]: knock.knocked_at,
                },
              },
            ],
          );
        }
      }
    } catch (err) {
      console.warn("[mirror-knock] household Last_* update failed", {
        knockEventId,
        message: (err as Error).message,
      });
    }
  }

  return { status: "ok", knockEventId, airtableRecId };
}

function formatAnswer(answer: unknown): string {
  if (answer === null || answer === undefined) return "(no answer)";
  if (typeof answer === "string") return answer;
  if (typeof answer === "number" || typeof answer === "boolean") return String(answer);
  if (Array.isArray(answer)) return answer.map((a) => String(a)).join(", ");
  try {
    return JSON.stringify(answer);
  } catch {
    return String(answer);
  }
}

// Voter Key is the primary field on the Voters table — the search
// filterByFormula gets the rec id without us caching it.
async function findVoterRecId(
  airtable: AirtableClient,
  baseId: string,
  tableId: string,
  voterKey: string,
): Promise<string | null> {
  const formula = `{${VOTER_FIELDS.voterKey}} = "${escapeFormulaString(voterKey)}"`;
  for await (const rec of airtable.listAll<{ id: string }>(baseId, tableId, {
    filterByFormula: formula,
    pageSize: 1,
    fields: [VOTER_FIELDS.voterKey],
  })) {
    return rec.id;
  }
  return null;
}

async function findHouseholdRecId(
  airtable: AirtableClient,
  baseId: string,
  tableId: string,
  householdKey: string,
): Promise<string | null> {
  const formula = `{${HOUSEHOLD_FIELDS.householdKey}} = "${escapeFormulaString(householdKey)}"`;
  for await (const rec of airtable.listAll<{ id: string }>(baseId, tableId, {
    filterByFormula: formula,
    pageSize: 1,
    fields: [HOUSEHOLD_FIELDS.householdKey],
  })) {
    return rec.id;
  }
  return null;
}

// Airtable formula strings need escaping — backslash + double-quote
// are the only special chars in this context.
function escapeFormulaString(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
