"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square, Upload, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type Stage = "idle" | "recording" | "review" | "uploading" | "done" | "error";

export function VoiceRecorder({
  knockEventId,
  hasConsent,
  onUploaded,
}: {
  knockEventId: string;
  hasConsent: boolean;
  onUploaded?: (voiceNoteId: string) => void;
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
    if (!hasConsent) {
      setError("Voice-note consent hasn't been granted yet.");
      return;
    }
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
      form.set("knock_event_id", knockEventId);
      form.set("audio", blob, `note-${Date.now()}.webm`);
      form.set("duration_seconds", String(seconds));
      const res = await fetch("/api/knocker/voice-notes", { method: "POST", body: form });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `${res.status}`);
      setStage("done");
      onUploaded?.(body.voice_note.id as string);
    } catch (e) {
      setError((e as Error).message);
      setStage("error");
    }
  }

  if (!hasConsent) {
    return (
      <p className="rounded-md border border-dashed border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
        Turn on voice-note recording from your profile first.
      </p>
    );
  }

  return (
    <div className="rounded-md border border-border bg-white p-3 text-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mic className="h-4 w-4 text-navy-700" />
          <span className="font-medium text-navy-900">Voice note</span>
        </div>
        {stage === "recording" ? (
          <span className="inline-flex items-center gap-1 text-xs text-crimson">
            <span className="h-2 w-2 animate-pulse rounded-full bg-crimson" /> {format(seconds)}
          </span>
        ) : null}
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        {stage === "idle" || stage === "error" ? (
          <Button size="sm" onClick={start} variant="accent">
            <Mic className="mr-1.5 h-3.5 w-3.5" /> Start
          </Button>
        ) : null}
        {stage === "recording" ? (
          <Button size="sm" onClick={stop} variant="outline">
            <Square className="mr-1.5 h-3.5 w-3.5" /> Stop
          </Button>
        ) : null}
        {stage === "review" ? (
          <>
            <Button size="sm" onClick={upload} variant="accent">
              <Upload className="mr-1.5 h-3.5 w-3.5" /> Save ({format(seconds)})
            </Button>
            <Button size="sm" onClick={discard} variant="ghost">
              <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Discard
            </Button>
          </>
        ) : null}
        {stage === "uploading" ? (
          <p className="text-xs text-muted-foreground">Uploading…</p>
        ) : null}
        {stage === "done" ? (
          <p className="text-xs text-emerald-700">Saved — transcription queued.</p>
        ) : null}
      </div>
      {error ? (
        <p className="mt-2 rounded bg-crimson/10 px-3 py-1 text-xs text-crimson">{error}</p>
      ) : null}
    </div>
  );
}

function format(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}
