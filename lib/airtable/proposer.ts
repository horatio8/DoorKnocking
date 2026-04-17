// AI-assisted Airtable → platform field-mapping proposer.
// Server-only. Uses prompt caching on the system prompt + platform schema so
// repeated runs across districts don't re-pay for the static context.

import Anthropic from "@anthropic-ai/sdk";
import { anthropicEnv } from "@/lib/env";
import {
  PLATFORM_FIELDS,
  type FieldMapping,
  type MappingProposal,
} from "./mapping";
import type { AirtableField } from "./metadata";

interface SampleRow {
  id: string;
  fields: Record<string, unknown>;
}

interface ProposeArgs {
  airtableTableName: string;
  airtableFields: AirtableField[];
  sampleRows: SampleRow[];
}

const MODEL = "claude-sonnet-4-6";

const SYSTEM_PROMPT = `You map fields from an arbitrary Airtable voter table onto a fixed platform schema.

Be conservative: when there is no plausible match, leave the platform field unmapped (null). Prefer high-confidence one-to-one matches; only use medium / low confidence when the meaning is plausible but ambiguous (e.g. an "Address" field that probably contains street + city + state combined).

Output strictly JSON conforming to the schema you are given. No prose outside the JSON object.

Platform schema (fixed across all clients):

${PLATFORM_FIELDS.map((f) => `- ${f.key} (${f.required ? "REQUIRED" : "optional"}, ${f.group}): ${f.label}. ${f.description}`).join("\n")}

Rules:
- Each platform field maps to AT MOST one Airtable field.
- One Airtable field may be referenced by multiple platform fields if obviously composite (rare).
- If the Airtable column contains a composite (e.g. "Full Name" or "Full Address"), warn instead of trying to split — humans will set up a formula in Airtable.
- "Voter key (unique row ID)" should map to whichever Airtable field is unique-per-row. Often called VoterKey, VoterID, StateVoterID, or similar. If nothing is obvious, fall back to the table's primary field.
- "Household ID" should be a field that identical addresses share. Usually called HHRecId, HouseholdID, AddressKey. If absent, leave null — the platform will derive one from the address.
- Boolean-like fields ("Moved", "Active") should map to platform booleans only when their values are obviously T/F-shaped.
`;

const RESPONSE_SCHEMA_INSTRUCTION = `Return JSON exactly matching:

{
  "mapping": { "<platform_field_key>": "<airtable_field_name>" | null, ... },
  "confidence": { "<platform_field_key>": "high" | "medium" | "low", ... },
  "reasoning": { "<platform_field_key>": "one short sentence", ... },
  "unmapped_airtable_fields": ["<airtable_field_name>", ...],
  "warnings": ["<short string>", ...]
}

Include every platform field as a key in "mapping" and "confidence" (use null if no match). "reasoning" is required only for non-null mappings.`;

export async function proposeMapping({
  airtableTableName,
  airtableFields,
  sampleRows,
}: ProposeArgs): Promise<MappingProposal> {
  const env = anthropicEnv();
  const client = new Anthropic({ apiKey: env.apiKey });

  const fieldsBlock = airtableFields
    .map((f) => {
      const examples = sampleRows
        .map((r) => r.fields[f.name])
        .filter((v) => v !== undefined && v !== null && v !== "")
        .slice(0, 3);
      const examplesStr = examples.length > 0
        ? ` Examples: ${examples.map((v) => JSON.stringify(v)).join(", ")}.`
        : " (no examples)";
      return `- "${f.name}" (Airtable type: ${f.type}).${examplesStr}`;
    })
    .join("\n");

  const userPrompt = `Airtable table: "${airtableTableName}"

Fields available in this table:
${fieldsBlock}

${RESPONSE_SCHEMA_INSTRUCTION}`;

  // System prompt is large + static; ephemeral cache lets repeat mappings
  // across districts share the cache. Cast to bypass an SDK type gap — the
  // API supports `cache_control` on text blocks since claude-3.5.
  const systemBlocks = [
    {
      type: "text" as const,
      text: SYSTEM_PROMPT,
      cache_control: { type: "ephemeral" },
    },
  ] as unknown as Array<{ type: "text"; text: string }>;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2000,
    system: systemBlocks,
    messages: [{ role: "user", content: userPrompt }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude returned no text content");
  }

  const cleaned = stripCodeFence(textBlock.text);
  let parsed: MappingProposal;
  try {
    parsed = JSON.parse(cleaned) as MappingProposal;
  } catch (err) {
    throw new Error(`Failed to parse mapping JSON: ${(err as Error).message}\n\nRaw: ${cleaned.slice(0, 500)}`);
  }

  // Defensive: ensure every platform field key is present.
  const mapping: FieldMapping = {};
  const confidence: MappingProposal["confidence"] = {};
  for (const pf of PLATFORM_FIELDS) {
    mapping[pf.key] = parsed.mapping?.[pf.key] ?? null;
    confidence[pf.key] = parsed.confidence?.[pf.key] ?? "low";
  }

  return {
    mapping,
    confidence,
    reasoning: parsed.reasoning ?? {},
    unmapped_airtable_fields: parsed.unmapped_airtable_fields ?? [],
    warnings: parsed.warnings ?? [],
  };
}

function stripCodeFence(s: string): string {
  const trimmed = s.trim();
  if (trimmed.startsWith("```")) {
    return trimmed.replace(/^```(?:json)?\n?/, "").replace(/```$/, "").trim();
  }
  return trimmed;
}
