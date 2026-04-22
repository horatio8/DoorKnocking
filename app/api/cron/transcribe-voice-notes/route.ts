import { NextResponse } from "next/server";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import {
  summariseConversation,
  type Utterance,
} from "@/lib/ai/conversation-summary";
import { mirrorConversationToAirtable } from "@/lib/airtable/mirror-conversation";

// Transcription worker:
//   1. Fetch a batch of pending voice_notes
//   2. Whisper verbose_json for word-level timestamps
//   3. Heuristic diarisation (alternate speakers on long silences, start
//      with the volunteer) when note_kind='conversation'
//   4. Claude structured summary for conversation notes
//   5. Mirror conversation notes to the client's Airtable Conversations table
//
// Every step no-ops gracefully when upstream is unconfigured so deploys
// without WHISPER_API_KEY / ANTHROPIC_API_KEY / per-client Airtable tokens
// don't jam the queue.

export const dynamic = "force-dynamic";

const BUCKET = "conversation-recordings";
// Pause between Whisper segments (seconds) that looks like a speaker flip.
const FLIP_GAP_S = 0.9;

export async function GET() {
  const authKey = process.env.CRON_SECRET;
  const supabase = getSupabaseServiceRoleClient();

  const { data: pending } = await supabase
    .from("voice_notes")
    .select("id, audio_storage_path, note_kind, voter_id")
    .eq("transcription_status", "pending")
    .order("created_at", { ascending: true })
    .limit(5);
  const rows = (pending ?? []) as Array<{
    id: string;
    audio_storage_path: string;
    note_kind: "stop_note" | "conversation" | null;
    voter_id: string | null;
  }>;
  if (rows.length === 0) return NextResponse.json({ ok: true, processed: 0 });

  const results: Array<{ id: string; status: string; error?: string }> = [];
  for (const note of rows) {
    await supabase
      .from("voice_notes")
      .update({ transcription_status: "processing" })
      .eq("id", note.id);

    try {
      if (!process.env.WHISPER_API_KEY) {
        results.push({ id: note.id, status: "skipped (no WHISPER_API_KEY)" });
        continue;
      }

      const { data: signed, error: signedErr } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(note.audio_storage_path, 60 * 10);
      if (signedErr || !signed) throw new Error(signedErr?.message ?? "signed url failed");
      const audioRes = await fetch(signed.signedUrl);
      if (!audioRes.ok) throw new Error(`audio fetch ${audioRes.status}`);
      const audioBlob = await audioRes.blob();

      // verbose_json gives us segment timings we use for diarisation.
      const form = new FormData();
      form.set("file", audioBlob, "note.webm");
      form.set("model", "whisper-1");
      form.set("response_format", "verbose_json");
      const whisper = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.WHISPER_API_KEY}` },
        body: form,
      });
      if (!whisper.ok) throw new Error(`whisper ${whisper.status}`);
      const json = (await whisper.json()) as {
        text?: string;
        segments?: Array<{ start?: number; end?: number; text?: string }>;
      };
      const transcript = (json.text ?? "").trim();

      const segments = Array.isArray(json.segments) ? json.segments : [];
      let speakerSegments: Utterance[] = [];
      if (note.note_kind === "conversation" && segments.length > 0) {
        // Heuristic: volunteer speaks first; every gap > FLIP_GAP_S flips
        // the speaker. Not as good as pyannote but good enough to ship a
        // usable debrief v1 — upgrade later.
        let speaker: "volunteer" | "voter" = "volunteer";
        let prevEnd = 0;
        for (const s of segments) {
          const start = typeof s.start === "number" ? s.start : 0;
          const end = typeof s.end === "number" ? s.end : start;
          const text = (s.text ?? "").trim();
          if (!text) continue;
          if (start - prevEnd > FLIP_GAP_S && prevEnd > 0) {
            speaker = speaker === "volunteer" ? "voter" : "volunteer";
          }
          speakerSegments.push({ speaker, text, start_s: start, end_s: end });
          prevEnd = end;
        }
      } else {
        // Stop-note fallback: one volunteer-attributed utterance.
        speakerSegments = [{ speaker: "volunteer", text: transcript }];
      }

      let summary: Record<string, unknown> | null = null;
      if (note.note_kind === "conversation" && process.env.ANTHROPIC_API_KEY) {
        const s = await summariseConversation(speakerSegments);
        summary = s ? (s as unknown as Record<string, unknown>) : null;
      }

      await supabase
        .from("voice_notes")
        .update({
          transcript,
          speaker_segments: speakerSegments,
          structured_summary: summary,
          transcription_status: "complete",
          transcribed_at: new Date().toISOString(),
        })
        .eq("id", note.id);

      // Airtable mirror — conversation rows only; silent skip if the
      // client hasn't wired Airtable or the Conversations table.
      if (note.note_kind === "conversation" && note.voter_id) {
        const signedAudio = signed.signedUrl;
        try {
          const airtableId = await mirrorConversationToAirtable({
            supabase,
            voiceNoteId: note.id,
            voterId: note.voter_id,
            audioUrl: signedAudio,
            transcriptText: transcript,
            speakerSegments,
            summary,
            recordedAt: new Date().toISOString(),
          });
          if (airtableId) {
            await supabase
              .from("voice_notes")
              .update({ airtable_conversation_id: airtableId })
              .eq("id", note.id);
          }
        } catch (mirrorErr) {
          console.error("[transcribe] airtable mirror failed", note.id, mirrorErr);
        }
      }

      results.push({ id: note.id, status: "complete" });
    } catch (err) {
      console.error("transcribe failed", note.id, err);
      await supabase
        .from("voice_notes")
        .update({ transcription_status: "pending" })
        .eq("id", note.id);
      results.push({ id: note.id, status: "error", error: (err as Error).message });
    }
    // Rate-limit buffer
    await new Promise((r) => setTimeout(r, 250));
  }

  return NextResponse.json({
    ok: true,
    processed: rows.length,
    results,
    authKeySeen: Boolean(authKey),
  });
}
