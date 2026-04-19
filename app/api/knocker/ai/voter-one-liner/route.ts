import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { anthropicEnv } from "@/lib/env";

// POST /api/knocker/ai/voter-one-liner
// Body: { voterId: string }
// Returns a single cached one-liner suggestion for what to say when this
// voter opens the door. Cached per voter in ai_suggestions.

const MODEL = "claude-haiku-4-5-20251001";
const PROMPT = `You are a canvassing coach. In ONE friendly sentence (max 20 words), suggest what the door-knocker might say at the doorstep to open a warm conversation with this voter — based ONLY on the facts given. Don't invent anything. If there's nothing useful, return: "Introduce yourself and ask what's on their mind."`;

export async function POST(req: Request) {
  const session = await loadSession();
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { voterId?: string };
  if (!body.voterId) return NextResponse.json({ error: "voterId required" }, { status: 400 });

  const supabase = getSupabaseServiceRoleClient();

  // Cached result?
  const { data: cached } = await supabase
    .from("ai_suggestions")
    .select("id, output, created_at")
    .eq("kind", "voter_one_liner")
    .eq("input->>voter_id", body.voterId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (cached) {
    const out = (cached as { output: { text?: string } | null }).output;
    if (out?.text) return NextResponse.json({ text: out.text, cached: true });
  }

  // Pull facts about the voter — keep payload tight to stay cheap.
  const { data: voter } = await supabase
    .from("voters")
    .select(
      "display_name, observed_party, official_party, calculated_party, current_status, primary_phone",
    )
    .eq("id", body.voterId)
    .maybeSingle();
  if (!voter) return NextResponse.json({ error: "voter not found" }, { status: 404 });

  const { data: tags } = await supabase
    .from("voter_tags")
    .select("tags(label)")
    .eq("voter_id", body.voterId);
  const labels = ((tags ?? []) as Array<{ tags: { label: string } | Array<{ label: string }> | null }>)
    .map((t) => (Array.isArray(t.tags) ? t.tags[0]?.label : t.tags?.label))
    .filter((x): x is string => Boolean(x));

  const facts = {
    name: (voter as { display_name: string }).display_name,
    party:
      (voter as { calculated_party: string | null }).calculated_party ??
      (voter as { official_party: string | null }).official_party ??
      (voter as { observed_party: string | null }).observed_party,
    lastStatus: (voter as { current_status: string }).current_status,
    tags: labels,
  };

  try {
    const client = new Anthropic({ apiKey: anthropicEnv().apiKey });
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 120,
      system: PROMPT,
      messages: [{ role: "user", content: JSON.stringify(facts) }],
    });
    const text = resp.content
      .map((c) => (c.type === "text" ? c.text : ""))
      .join("")
      .trim();

    await supabase.from("ai_suggestions").insert({
      user_id: session.user.id,
      kind: "voter_one_liner",
      input: { voter_id: body.voterId, facts },
      output: { text },
      model: MODEL,
      tokens_used: resp.usage?.input_tokens
        ? resp.usage.input_tokens + (resp.usage.output_tokens ?? 0)
        : null,
    });

    return NextResponse.json({ text, cached: false });
  } catch (err) {
    console.error("voter one-liner failed", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
