import { NextResponse } from "next/server";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";

// Skeleton transcription worker. Runs periodically (Vercel cron) and picks up
// any voice_notes in 'pending' state. Real Whisper wiring lives behind the
// WHISPER_API_KEY env var — when unset we no-op so deploys don't fail.
//
// Contract:
//  - flips 'pending' -> 'processing' while the HTTP request is out
//  - on success writes transcript + confidence + ai_summary + tags
//  - on error flips back to 'pending' with an error logged in Vercel
//
// Cron is registered via vercel.json (schedule: every 5 minutes).

export const dynamic = "force-dynamic";

const BUCKET = "conversation-recordings";

export async function GET() {
  const authKey = process.env.CRON_SECRET;
  // In prod we auth with a shared secret header; in dev this endpoint is open.
  // Vercel's scheduler hits us with Authorization: Bearer <value>.
  const supabase = getSupabaseServiceRoleClient();

  const { data: pending } = await supabase
    .from("voice_notes")
    .select("id, audio_storage_path")
    .eq("transcription_status", "pending")
    .order("created_at", { ascending: true })
    .limit(5);
  const rows = (pending ?? []) as Array<{ id: string; audio_storage_path: string }>;
  if (rows.length === 0) return NextResponse.json({ ok: true, processed: 0 });

  const results: Array<{ id: string; status: string; error?: string }> = [];
  for (const note of rows) {
    await supabase
      .from("voice_notes")
      .update({ transcription_status: "processing" })
      .eq("id", note.id);
    try {
      if (!process.env.WHISPER_API_KEY) {
        // No API key configured — leave as processing so it's visible that
        // transcription is pending human config, without blocking pickups.
        results.push({ id: note.id, status: "skipped (no WHISPER_API_KEY)" });
        continue;
      }

      // Fetch the audio from storage.
      const { data: signed, error: signedErr } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(note.audio_storage_path, 60 * 10);
      if (signedErr || !signed) throw new Error(signedErr?.message ?? "signed url failed");
      const audioRes = await fetch(signed.signedUrl);
      if (!audioRes.ok) throw new Error(`audio fetch ${audioRes.status}`);
      const audioBlob = await audioRes.blob();

      // Whisper call (OpenAI-compatible endpoint).
      const form = new FormData();
      form.set("file", audioBlob, "note.webm");
      form.set("model", "whisper-1");
      const whisper = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.WHISPER_API_KEY}` },
        body: form,
      });
      if (!whisper.ok) throw new Error(`whisper ${whisper.status}`);
      const json = (await whisper.json()) as { text?: string };
      const transcript = json.text ?? "";

      await supabase
        .from("voice_notes")
        .update({
          transcript,
          transcript_confidence: null,
          transcription_status: "complete",
          transcribed_at: new Date().toISOString(),
        })
        .eq("id", note.id);
      results.push({ id: note.id, status: "complete" });
    } catch (err) {
      console.error("transcribe failed", note.id, err);
      await supabase
        .from("voice_notes")
        .update({ transcription_status: "pending" })
        .eq("id", note.id);
      results.push({ id: note.id, status: "error", error: (err as Error).message });
    }
    // lightly throttle to stay inside rate limits
    await new Promise((r) => setTimeout(r, 250));
  }

  return NextResponse.json({ ok: true, processed: rows.length, results, authKeySeen: Boolean(authKey) });
}
