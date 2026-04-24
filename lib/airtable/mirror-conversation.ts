import { AirtableClient } from "./client";
import { resolveAirtableTokenForDistrict } from "./credentials";
import { CONVERSATION_FIELDS } from "./schema";
import type { SupabaseClient } from "@supabase/supabase-js";

// Pushes a diarised + summarised conversation into the client's Airtable
// base — writes a row in the `Conversations` table (one per recording)
// and links it to the Primary Voter record via the voter's airtable rec id.
//
// Missing token / base / table id → logged + swallowed so the cron worker
// doesn't get stuck on a single failure.

const CONVERSATIONS_TABLE_FIELD = "airtable_conversations_table_id";

export interface ConversationMirrorInput {
  supabase: SupabaseClient;
  voiceNoteId: string;
  voterId: string;
  audioUrl: string | null;
  transcriptText: string;
  speakerSegments: Array<{ speaker: string; text: string; start_s?: number; end_s?: number }>;
  summary: Record<string, unknown> | null;
  recordedAt: string;
}

export async function mirrorConversationToAirtable(
  opts: ConversationMirrorInput,
): Promise<string | null> {
  const { supabase, voterId } = opts;

  const { data: voterRow } = await supabase
    .from("voters")
    .select("id, display_name, airtable_voter_key, district_id, households(airtable_hh_rec_id)")
    .eq("id", voterId)
    .maybeSingle();
  const voter = voterRow as
    | {
        id: string;
        display_name: string;
        airtable_voter_key: string | null;
        district_id: string;
      }
    | null;
  if (!voter) return null;

  const { data: districtRow } = await supabase
    .from("districts")
    .select(`airtable_base_id, client_id, ${CONVERSATIONS_TABLE_FIELD}`)
    .eq("id", voter.district_id)
    .maybeSingle();
  const district = districtRow as
    | { airtable_base_id: string | null; client_id: string | null; [k: string]: string | null }
    | null;
  if (!district?.airtable_base_id) return null;
  const convTableId = (district[CONVERSATIONS_TABLE_FIELD] as string | null) ?? null;
  if (!convTableId) {
    console.warn(
      "[mirrorConversation] district missing airtable_conversations_table_id — skipping",
    );
    return null;
  }
  if (!voter.airtable_voter_key) {
    console.warn("[mirrorConversation] voter has no airtable_voter_key — skipping");
    return null;
  }

  const creds = await resolveAirtableTokenForDistrict(voter.district_id);
  if (!creds?.token) {
    console.warn("[mirrorConversation] no airtable token for client — skipping");
    return null;
  }

  const client = new AirtableClient(creds.token);
  const transcriptForField = opts.speakerSegments
    .map((s) => `${s.speaker.toUpperCase()}: ${s.text}`)
    .join("\n")
    .slice(0, 90_000); // Airtable long-text cap safety

  const fields: Record<string, unknown> = {
    [CONVERSATION_FIELDS.voiceNoteId]: opts.voiceNoteId,
    // Linked field: Airtable resolves the primary-field string via typecast.
    [CONVERSATION_FIELDS.voter]: [voter.airtable_voter_key],
    [CONVERSATION_FIELDS.voterName]: voter.display_name,
    [CONVERSATION_FIELDS.recordedAt]: opts.recordedAt,
    [CONVERSATION_FIELDS.audioUrl]: opts.audioUrl ?? null,
    [CONVERSATION_FIELDS.transcript]: transcriptForField,
  };
  if (opts.summary) {
    const s = opts.summary as Record<string, unknown>;
    if (typeof s.one_liner === "string") fields[CONVERSATION_FIELDS.summary] = s.one_liner;
    if (Array.isArray(s.top_concerns)) {
      fields[CONVERSATION_FIELDS.topConcerns] = (s.top_concerns as unknown[]).join(", ");
    }
    if (typeof s.committed === "boolean") fields[CONVERSATION_FIELDS.committed] = s.committed;
    if (Array.isArray(s.tags)) {
      fields[CONVERSATION_FIELDS.tags] = (s.tags as unknown[]).join(", ");
    }
    if (Array.isArray(s.asks)) {
      fields[CONVERSATION_FIELDS.asks] = (s.asks as unknown[]).join(" · ");
    }
    if (typeof s.sentiment === "string") fields[CONVERSATION_FIELDS.sentiment] = s.sentiment;
  }

  const created = await client.batchCreate(district.airtable_base_id, convTableId, [{ fields }]);
  return created[0]?.id ?? null;
}
