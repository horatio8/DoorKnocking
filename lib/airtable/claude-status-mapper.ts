// Claude-assisted status interpreter for the CSV knock importer.
//
// When a row's `knock_status` value doesn't match the local alias
// dictionary (lib/airtable/import-knocks.ts → STATUS_ALIASES), instead
// of skipping silently we ask Claude to map it to one of the canonical
// `knock_events.status` enum values: contacted, no_answer,
// come_back_later, refused, wrong_address, or null when nothing fits.
//
// One round-trip per import: we send all distinct unknowns at once.
// Cheap, deterministic-ish, and the result is returned alongside the
// import counts so the admin can audit what Claude inferred and add
// long-tail values as explicit aliases later.

import Anthropic from "@anthropic-ai/sdk";
import { anthropicEnv } from "@/lib/env";

export type CanonicalKnockStatus =
  | "contacted"
  | "no_answer"
  | "come_back_later"
  | "refused"
  | "wrong_address";

const CANONICAL_STATUSES: CanonicalKnockStatus[] = [
  "contacted",
  "no_answer",
  "come_back_later",
  "refused",
  "wrong_address",
];

export interface ClaudeStatusInference {
  // Original CSV value (lowercased — same shape unknownCounts uses as key).
  value: string;
  // Canonical mapping or null when Claude couldn't justify one.
  mapped_to: CanonicalKnockStatus | null;
  // "high" | "medium" | "low" — admin uses this to decide whether to
  // accept blindly or audit before promoting to a permanent alias.
  confidence: "high" | "medium" | "low";
  // One short sentence explaining the call. Surfaced verbatim in the
  // wizard's done-state panel so the admin sees Claude's reasoning.
  reason: string;
}

export interface ClaudeStatusMappingResult {
  // Inferences keyed by lowercased input value. Use this directly to
  // augment STATUS_ALIASES at runtime in the importer.
  byValue: Map<string, ClaudeStatusInference>;
  // True when ANTHROPIC_API_KEY is missing or the call failed; the
  // import path falls back to skipping unknown values as before.
  skipped: boolean;
  skippedReason: string | null;
  // Round-trip ms — useful for the admin to know how much latency
  // Claude added to the import.
  durationMs: number;
}

const MODEL = "claude-opus-4-7";

const SYSTEM_PROMPT = `You map opaque CSV knock-status values to a canonical enum used by a door-knocking platform.

Canonical values (return exactly one of these strings, or null when none fits):
- contacted: a volunteer spoke to the voter at the door, regardless of how the conversation went
- no_answer: nobody answered the door / not home
- come_back_later: voter asked the volunteer to return at another time
- refused: voter actively refused to engage
- wrong_address: voter no longer at this address (moved, vacant, demolished, wrong house)

Rules:
- Voter-file "support level" codes (e.g. "supportive", "undecided", "lean yes", "strong no", "S", "U", "N") all imply the voter ANSWERED the door, so map them to "contacted" — the support level itself is preserved separately by the importer.
- Codes that imply "the door was knocked but nobody answered" (e.g. "NH", "Not Home", "No Contact") map to "no_answer".
- "Moved", "Bad Address", "Vacant" map to "wrong_address".
- "Refused", "Hostile", "Slammed door" map to "refused".
- "Callback", "CB", "Come Back" map to "come_back_later".
- Inputs may follow a "<code> - <description>" shape (e.g. "S - Supportive"); use the description to disambiguate.
- When the value is genuinely ambiguous or unrelated to door-knocking, return mapped_to: null with a low-confidence reason — better to skip than guess wrong.

Output strictly JSON conforming to the schema you are given. No prose outside the JSON object.`;

const RESPONSE_SCHEMA_INSTRUCTION = `Return JSON exactly matching:

{
  "inferences": [
    { "value": "<the input value, lowercased and trimmed>", "mapped_to": "<canonical | null>", "confidence": "high" | "medium" | "low", "reason": "<one sentence>" },
    ...
  ]
}

Include one entry per input value, in the same order, with "value" matching the lowercased+trimmed input.`;

export async function mapUnknownStatusesViaClaude(
  values: string[],
): Promise<ClaudeStatusMappingResult> {
  const startedAt = Date.now();
  const empty: ClaudeStatusMappingResult = {
    byValue: new Map(),
    skipped: false,
    skippedReason: null,
    durationMs: 0,
  };
  if (values.length === 0) return empty;

  let apiKey: string;
  try {
    apiKey = anthropicEnv().apiKey;
  } catch {
    return {
      ...empty,
      skipped: true,
      skippedReason: "ANTHROPIC_API_KEY not set",
      durationMs: Date.now() - startedAt,
    };
  }

  const client = new Anthropic({ apiKey });

  // Dedupe + lowercase the inputs so the prompt is deterministic
  // and the cache key stays stable across imports with overlapping
  // vocabularies.
  const normalised = Array.from(
    new Set(values.map((v) => v.trim().toLowerCase()).filter(Boolean)),
  );

  const userPrompt = `Map these CSV knock-status values to the canonical enum:

${normalised.map((v, i) => `${i + 1}. "${v}"`).join("\n")}

${RESPONSE_SCHEMA_INSTRUCTION}`;

  // Cache the system prompt — it doesn't vary across imports, so
  // every subsequent call hits the cache for the static portion.
  const systemBlocks = [
    {
      type: "text" as const,
      text: SYSTEM_PROMPT,
      cache_control: { type: "ephemeral" },
    },
  ] as unknown as Array<{ type: "text"; text: string }>;

  let raw: string;
  try {
    // The installed SDK version predates the `thinking` parameter
    // type definition, so we pass a plain create call. For a simple
    // classification (5–30 short strings) Claude doesn't need
    // explicit reasoning to produce reliable mappings — the cached
    // system prompt already encodes the rules.
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: systemBlocks,
      messages: [{ role: "user", content: userPrompt }],
    });
    const textBlock = response.content.find(
      (b): b is { type: "text"; text: string } => b.type === "text",
    );
    if (!textBlock) {
      console.warn("[csv:claude-status] no text content in response");
      return {
        ...empty,
        skipped: true,
        skippedReason: "Claude returned no text content",
        durationMs: Date.now() - startedAt,
      };
    }
    raw = textBlock.text;
  } catch (err) {
    const message = (err as Error).message;
    console.warn("[csv:claude-status] api call failed", { message });
    return {
      ...empty,
      skipped: true,
      skippedReason: `Claude API error: ${message}`,
      durationMs: Date.now() - startedAt,
    };
  }

  const cleaned = stripCodeFence(raw);
  let parsed: { inferences?: unknown };
  try {
    parsed = JSON.parse(cleaned) as { inferences?: unknown };
  } catch (err) {
    console.warn("[csv:claude-status] parse error", {
      message: (err as Error).message,
      preview: cleaned.slice(0, 200),
    });
    return {
      ...empty,
      skipped: true,
      skippedReason: `Could not parse Claude response as JSON: ${(err as Error).message}`,
      durationMs: Date.now() - startedAt,
    };
  }

  const inferencesRaw = Array.isArray(parsed.inferences) ? parsed.inferences : [];
  const byValue = new Map<string, ClaudeStatusInference>();
  for (const item of inferencesRaw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const value = typeof r.value === "string" ? r.value.trim().toLowerCase() : null;
    if (!value) continue;
    const mapped = typeof r.mapped_to === "string" ? r.mapped_to : null;
    const mappedSafe = (
      mapped && (CANONICAL_STATUSES as string[]).includes(mapped)
        ? (mapped as CanonicalKnockStatus)
        : null
    );
    const confidence =
      r.confidence === "high" || r.confidence === "medium" || r.confidence === "low"
        ? r.confidence
        : "low";
    const reason = typeof r.reason === "string" ? r.reason : "";
    byValue.set(value, {
      value,
      mapped_to: mappedSafe,
      confidence,
      reason,
    });
  }

  const durationMs = Date.now() - startedAt;
  console.info("[csv:claude-status] mapped", {
    requestedCount: normalised.length,
    returnedCount: byValue.size,
    matched: Array.from(byValue.values()).filter((v) => v.mapped_to).length,
    durationMs,
  });
  return { byValue, skipped: false, skippedReason: null, durationMs };
}

function stripCodeFence(text: string): string {
  const t = text.trim();
  if (t.startsWith("```")) {
    return t
      .replace(/^```(?:json)?\n?/, "")
      .replace(/\n?```$/, "")
      .trim();
  }
  return t;
}
