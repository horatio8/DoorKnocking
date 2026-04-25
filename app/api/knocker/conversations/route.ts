import { NextResponse } from "next/server";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { syncKnockNow } from "@/lib/airtable/sync-knock-now";

// POST /api/knocker/conversations  (multipart)
//   audio: File
//   voter_id: string (required — the conversation partner)
//   duration_seconds?: string
//   knock_event_id?: string (optional — attach to the current knock)
//
// Records a free-chat conversation. Piggybacks on the voice_notes row + the
// `conversation-recordings` storage bucket already provisioned for K9, just
// with note_kind='conversation' + voter_id set so the transcriber knows to
// diarise + summarise + mirror to Airtable.

const BUCKET = "conversation-recordings";

export async function POST(req: Request) {
  const session = await loadSession();
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  // No software-side voice_note_consent check: the OS-level mic
  // permission prompt that fires from getUserMedia is the real
  // consent gate. The flag still lives on the user row for admin
  // visibility / opt-out, but it doesn't block the upload.

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "multipart/form-data required" }, { status: 400 });
  const voterId = form.get("voter_id");
  const audio = form.get("audio");
  const knockEventId = form.get("knock_event_id");
  const durationRaw = form.get("duration_seconds");
  if (typeof voterId !== "string" || !(audio instanceof Blob)) {
    return NextResponse.json({ error: "voter_id and audio required" }, { status: 400 });
  }
  if (audio.size === 0) {
    return NextResponse.json({ error: "empty audio" }, { status: 400 });
  }

  const supabase = getSupabaseServiceRoleClient();

  // If knock_event_id supplied, double-check it's the caller's. Required
  // for the voice_notes FK too.
  let resolvedKnockId: string | null = null;
  if (typeof knockEventId === "string" && knockEventId.length > 0) {
    const { data: ke } = await supabase
      .from("knock_events")
      .select("id, user_id")
      .eq("id", knockEventId)
      .maybeSingle();
    if (!ke || (ke as { user_id: string }).user_id !== session.user.id) {
      return NextResponse.json({ error: "knock event not yours" }, { status: 403 });
    }
    resolvedKnockId = (ke as { id: string }).id;
  } else {
    // No knock_event_id supplied — the volunteer hit "Record
    // conversation" before picking a status, so we synthesise a
    // minimal knock_events row first. voice_notes.knock_event_id
    // is NOT NULL, and knock_events.household_id is NOT NULL too,
    // so we have to look up the voter's household before inserting.
    // Status = contacted by definition (the volunteer is actively
    // recording a conversation with this voter); survey_* stay null.
    const { data: voterRow, error: vErr } = await supabase
      .from("voters")
      .select("id, household_id")
      .eq("id", voterId)
      .maybeSingle();
    const voter = voterRow as { id: string; household_id: string } | null;
    if (vErr || !voter) {
      return NextResponse.json(
        { error: `voter ${voterId} not found` },
        { status: 404 },
      );
    }
    const { data: ke, error: keErr } = await supabase
      .from("knock_events")
      .insert({
        household_id: voter.household_id,
        voter_id: voterId,
        user_id: session.user.id,
        status: "contacted",
        knocked_at: new Date().toISOString(),
        synced_at: new Date().toISOString(),
        client_event_id: `conversation-${Date.now()}-${session.user.id.slice(0, 8)}`,
      })
      .select("id")
      .single();
    if (keErr || !ke) {
      return NextResponse.json(
        { error: keErr?.message ?? "could not stage knock event" },
        { status: 500 },
      );
    }
    resolvedKnockId = ke.id as string;
    // Synthetic knock created — mirror it to Airtable inline so the
    // Knocks row is there before the conversation transcript lands
    // (the Conversations table's Voter link points at the same voter
    // anyway, so the two records line up in the base).
    await syncKnockNow(supabase, resolvedKnockId);
  }

  const ext =
    audio.type === "audio/webm"
      ? "webm"
      : audio.type === "audio/ogg"
        ? "ogg"
        : audio.type === "audio/mp4" || audio.type === "audio/m4a"
          ? "m4a"
          : "bin";
  const objectPath = `${session.user.id}/${voterId}/${Date.now()}.${ext}`;
  const arrayBuffer = await audio.arrayBuffer();

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(objectPath, new Uint8Array(arrayBuffer), {
      contentType: audio.type || "application/octet-stream",
      upsert: false,
    });
  if (upErr) return NextResponse.json({ error: `storage: ${upErr.message}` }, { status: 500 });

  const duration = typeof durationRaw === "string" ? Number(durationRaw) : null;
  const { data: row, error: insErr } = await supabase
    .from("voice_notes")
    .insert({
      knock_event_id: resolvedKnockId,
      user_id: session.user.id,
      voter_id: voterId,
      audio_storage_path: objectPath,
      audio_duration_seconds: Number.isFinite(duration) ? Math.round(duration!) : null,
      audio_format: audio.type || "audio/webm",
      transcription_status: "pending",
      note_kind: "conversation",
    })
    .select("*")
    .single();
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, voice_note: row });
}
