import { NextResponse } from "next/server";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";

// POST /api/knocker/voice-notes
// Body: multipart/form-data {
//   knock_event_id: string
//   audio: File (webm/ogg/mp4)
//   duration_seconds?: string
// }
// Uploads to Supabase Storage bucket `conversation-recordings` and creates a
// voice_notes row in 'pending' transcription state.

const BUCKET = "conversation-recordings";

export async function POST(req: Request) {
  const session = await loadSession();
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!session.user.voice_note_consent) {
    return NextResponse.json({ error: "voice-note consent required" }, { status: 403 });
  }

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "multipart/form-data required" }, { status: 400 });
  const knockEventId = form.get("knock_event_id");
  const audio = form.get("audio");
  const durationRaw = form.get("duration_seconds");
  if (typeof knockEventId !== "string" || !(audio instanceof Blob)) {
    return NextResponse.json({ error: "knock_event_id and audio required" }, { status: 400 });
  }
  if (audio.size === 0) {
    return NextResponse.json({ error: "empty audio" }, { status: 400 });
  }

  const supabase = getSupabaseServiceRoleClient();

  // Make sure the knock_event belongs to this user — defence in depth.
  const { data: ke } = await supabase
    .from("knock_events")
    .select("id, user_id")
    .eq("id", knockEventId)
    .maybeSingle();
  if (!ke || (ke as { user_id: string }).user_id !== session.user.id) {
    return NextResponse.json({ error: "knock event not yours" }, { status: 403 });
  }

  const ext =
    audio.type === "audio/webm"
      ? "webm"
      : audio.type === "audio/ogg"
        ? "ogg"
        : audio.type === "audio/mp4" || audio.type === "audio/m4a"
          ? "m4a"
          : "bin";
  const objectPath = `${session.user.id}/${knockEventId}/${Date.now()}.${ext}`;
  const arrayBuffer = await audio.arrayBuffer();

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(objectPath, new Uint8Array(arrayBuffer), {
      contentType: audio.type || "application/octet-stream",
      upsert: false,
    });
  if (upErr) {
    return NextResponse.json({ error: `storage: ${upErr.message}` }, { status: 500 });
  }

  const duration = typeof durationRaw === "string" ? Number(durationRaw) : null;
  const { data: row, error: insErr } = await supabase
    .from("voice_notes")
    .insert({
      knock_event_id: knockEventId,
      user_id: session.user.id,
      audio_storage_path: objectPath,
      audio_duration_seconds: Number.isFinite(duration) ? Math.round(duration!) : null,
      audio_format: audio.type || "audio/webm",
      transcription_status: "pending",
    })
    .select("*")
    .single();
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, voice_note: row });
}

export async function GET(req: Request) {
  const session = await loadSession();
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const url = new URL(req.url);
  const knockEventId = url.searchParams.get("knock_event_id");
  const supabase = getSupabaseServiceRoleClient();
  let query = supabase
    .from("voice_notes")
    .select("*")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false })
    .limit(50);
  if (knockEventId) query = query.eq("knock_event_id", knockEventId);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ voice_notes: data ?? [] });
}
