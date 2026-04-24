import Anthropic from "@anthropic-ai/sdk";
import { anthropicEnv } from "@/lib/env";

// Structured summariser for door-knock conversations. Takes the diarised
// transcript and returns a compact JSON blob the campaign can act on:
// top concerns the voter raised, whether they committed to anything,
// tags, asks/follow-ups, and an overall sentiment. Model is sonnet so
// nuance translates — upgrade to Haiku if the cost/quality tradeoff bites.

const MODEL = "claude-sonnet-4-6";

const SYSTEM_PROMPT = `You are a campaign-ops analyst summarising a door-to-door conversation between a VOLUNTEER and a VOTER.
Return JSON ONLY matching the schema exactly. No prose, no commentary, no markdown fences.

Rules:
- Pull signal ONLY from the voter's statements. The volunteer's script is context, not data.
- If the voter is ambiguous on a field, return null rather than guessing.
- "committed": true = the voter clearly committed to vote/help/attend; false = declined; null = unclear.
- "top_concerns" = up to 3 short issue phrases ("property taxes", "school zoning", "flooding") as spoken by the voter.
- "asks" = anything the voter requested (yard sign, follow-up, info). Empty array if none.
- "tags" = short labels the campaign can filter on. Lowercase, snake_case, ≤5 labels.
- "one_liner" = a single sentence (<25 words) capturing what the candidate needs to know.
- "sentiment": one of "supportive" | "leaning" | "neutral" | "skeptical" | "opposed".`;

const SCHEMA = `{
  "one_liner": "string",
  "top_concerns": ["string", ...],
  "committed": true | false | null,
  "asks": ["string", ...],
  "tags": ["snake_case", ...],
  "sentiment": "supportive|leaning|neutral|skeptical|opposed"
}`;

export interface ConversationSummary {
  one_liner: string;
  top_concerns: string[];
  committed: boolean | null;
  asks: string[];
  tags: string[];
  sentiment: "supportive" | "leaning" | "neutral" | "skeptical" | "opposed";
}

export interface Utterance {
  speaker: "volunteer" | "voter";
  text: string;
  start_s?: number;
  end_s?: number;
}

export async function summariseConversation(
  utterances: Utterance[],
): Promise<ConversationSummary | null> {
  if (utterances.length === 0) return null;
  const client = new Anthropic({ apiKey: anthropicEnv().apiKey });
  const formatted = utterances
    .map((u) => `${u.speaker.toUpperCase()}: ${u.text}`)
    .join("\n");
  try {
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 600,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content:
            `Return a JSON object matching this schema exactly:\n\n${SCHEMA}\n\n` +
            `Transcript:\n"""\n${formatted}\n"""`,
        },
      ],
    });
    const text = resp.content
      .map((c) => (c.type === "text" ? c.text : ""))
      .join("")
      .trim();
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    return JSON.parse(text.slice(start, end + 1)) as ConversationSummary;
  } catch (err) {
    console.error("[summariseConversation] failed", err);
    return null;
  }
}
