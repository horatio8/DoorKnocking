"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

// Inline button that fetches (and caches) an AI-suggested one-liner for the
// doorstep moment. Lives next to the voter row in <HouseholdDetail>.
export function VoterOneLiner({ voterId }: { voterId: string }) {
  const [text, setText] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchIt() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/knocker/ai/voter-one-liner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voterId }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `${res.status}`);
      setText(body.text as string);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (text) {
    return (
      <blockquote className="mt-1 rounded-md border border-navy-100 bg-navy-50/60 px-2 py-1 text-xs text-navy-800">
        <Sparkles className="mr-1 inline h-3 w-3 text-navy-500" />
        {text}
      </blockquote>
    );
  }
  return (
    <div className="mt-1 flex items-center gap-2 text-[11px]">
      <Button size="sm" variant="ghost" onClick={fetchIt} disabled={busy}>
        <Sparkles className="mr-1 h-3 w-3" /> {busy ? "Thinking…" : "Suggest an opener"}
      </Button>
      {error ? <span className="text-crimson">{error}</span> : null}
    </div>
  );
}
