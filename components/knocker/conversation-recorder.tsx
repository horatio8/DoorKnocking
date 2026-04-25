"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square, Upload, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type Stage = "idle" | "recording" | "review" | "uploading" | "done" | "error";

// Record-at-the-door component. Ties the recording to a specific voter via
// voter_id so the transcription cron can diarise, summarise, and mirror to
// Airtable under that voter's row.

export function ConversationRecorder({
  voterId,
  voterName,
  hasConsent,
  onUploaded,
  onCancel,
}: {
  voterId: string;
  voterName: string;
  hasConsent: boolean;
  onUploaded?: (voiceNoteId: string) => void;
  onCancel?: () => void;
}) {
  const [stage, setStage] = useState<Stage>("idle");
  const [seconds, setSeconds] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function start() {
    setError(null);
    // The OS-level mic permission prompt that fires from
    // getUserMedia is the real consent gate — no need to also gate
    // on the soft `voice_note_consent` flag. If the volunteer
    // declines the OS prompt, getUserMedia rejects and we surface
    // that error directly. The `hasConsent` prop is kept for
    // backwards compat with callers that still pass it (we just
    // no longer block on it).
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      recorderRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const b = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        setBlob(b);
        setStage("review");
        stream.getTracks().forEach((t) => t.stop());
      };
      rec.start();
      setStage("recording");
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch (e) {
      setError(`Couldn't start recording: ${(e as Error).message}`);
      setStage("error");
    }
  }

  function stop() {
    recorderRef.current?.stop();
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function discard() {
    setBlob(null);
    setStage("idle");
    setSeconds(0);
  }

  async function upload() {
    if (!blob) return;
    setStage("uploading");
    try {
      const form = new FormData();
      form.set("voter_id", voterId);
      form.set("audio", blob, `conversation-${Date.now()}.webm`);
      form.set("duration_seconds", String(seconds));
      const res = await fetch("/api/knocker/conversations", { method: "POST", body: form });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `${res.status}`);
      setStage("done");
      onUploaded?.(body.voice_note.id as string);
    } catch (e) {
      setError((e as Error).message);
      setStage("error");
    }
  }

  return (
    <div className="rounded-xl border-2 border-navy-100 bg-white p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-navy-600">
            Record conversation
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            with <strong className="text-navy-900">{voterName}</strong>
          </p>
        </div>
        {stage === "recording" ? (
          <span className="inline-flex items-center gap-1 text-xs text-crimson">
            <span className="h-2 w-2 animate-pulse rounded-full bg-crimson" /> {format(seconds)}
          </span>
        ) : null}
      </div>

      {stage === "idle" || stage === "error" ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button variant="outline" size="lg" onClick={onCancel} className="h-14 rounded-xl">
            Close
          </Button>
          <Button variant="accent" size="lg" onClick={start} className="h-14 rounded-xl">
            <Mic className="mr-1.5 h-4 w-4" /> Record
          </Button>
        </div>
      ) : null}

      {stage === "recording" ? (
        <div className="mt-3">
          <Button variant="outline" size="lg" onClick={stop} className="h-14 w-full rounded-xl">
            <Square className="mr-1.5 h-4 w-4" /> Stop &amp; review
          </Button>
        </div>
      ) : null}

      {stage === "review" ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button variant="outline" size="lg" onClick={discard} className="h-14 rounded-xl">
            <Trash2 className="mr-1.5 h-4 w-4" /> Discard
          </Button>
          <Button variant="accent" size="lg" onClick={upload} className="h-14 rounded-xl">
            <Upload className="mr-1.5 h-4 w-4" /> Save ({format(seconds)})
          </Button>
        </div>
      ) : null}

      {stage === "uploading" ? (
        <p className="mt-3 text-xs text-muted-foreground">Uploading — transcription queues next.</p>
      ) : null}
      {stage === "done" ? (
        <p className="mt-3 rounded bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          Saved. We&rsquo;ll transcribe + summarise in the background and push it to Airtable.
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 rounded bg-crimson/10 px-3 py-2 text-xs text-crimson">{error}</p>
      ) : null}

    </div>
  );
}

function format(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}
