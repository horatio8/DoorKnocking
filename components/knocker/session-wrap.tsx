"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function SessionWrap({
  sessionId,
  walkbookId,
  walkbookName,
  startedAt,
  endedAt,
  durationSeconds,
  doors,
  contacts,
  surveys,
  paceMultiplier,
}: {
  sessionId: string;
  walkbookId: string | null;
  walkbookName: string | null;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
  doors: number;
  contacts: number;
  surveys: number;
  paceMultiplier: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = !endedAt;

  const minutesElapsed = Math.max(
    0,
    Math.round(
      (durationSeconds ??
        (new Date(endedAt ?? new Date()).getTime() - new Date(startedAt).getTime()) / 1000) / 60,
    ),
  );
  const doorsPerHour = minutesElapsed > 0 ? Math.round((doors / minutesElapsed) * 60) : 0;
  const contactRate = doors > 0 ? Math.round((contacts / doors) * 100) : 0;

  async function endSession() {
    setBusy(true);
    setError(null);
    try {
      const elapsedSeconds = Math.round(
        (Date.now() - new Date(startedAt).getTime()) / 1000,
      );
      const res = await fetch("/api/knocker/session", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          end: true,
          knock_count: doors,
          duration_seconds: elapsedSeconds,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? `${res.status}`);
      // Flip availability back to "available" so admins know they're not out.
      await fetch("/api/knocker/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ availability: "available" }),
      }).catch(() => {});
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      <p className="text-xs uppercase tracking-widest text-navy-500">
        {active ? "Session in progress" : "Session wrap-up"}
      </p>
      <h1 className="mt-1 font-serif text-2xl font-semibold text-navy-900">
        {active ? "Nice work so far." : "All done — great job."}
      </h1>
      {walkbookName ? (
        <p className="text-sm text-muted-foreground">
          Walkbook: <span className="text-navy-900">{walkbookName}</span>
        </p>
      ) : null}

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Doors" value={doors} />
        <Stat label="Contacts" value={contacts} suffix={doors > 0 ? `${contactRate}%` : undefined} />
        <Stat label="Surveys" value={surveys} />
        <Stat label="Minutes" value={minutesElapsed} />
      </div>

      <div className="mt-4 rounded-md border border-navy-100 bg-white p-3 text-sm text-navy-800">
        <p className="text-xs font-semibold uppercase tracking-widest text-navy-700">Highlights</p>
        <ul className="mt-2 space-y-1 text-sm">
          <li>• Effective rate: {doorsPerHour}/hr (pace multiplier {paceMultiplier.toFixed(2)})</li>
          <li>• Started at {new Date(startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</li>
          {endedAt ? (
            <li>• Ended at {new Date(endedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</li>
          ) : null}
        </ul>
      </div>

      {error ? (
        <p className="mt-3 rounded bg-crimson/10 px-3 py-2 text-xs text-crimson">{error}</p>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2">
        {active ? (
          <Button onClick={endSession} disabled={busy} variant="accent">
            {busy ? "Ending…" : "End session"}
          </Button>
        ) : (
          <Button asChild variant="accent">
            <Link href="/app/walkbooks/browse">Start a new session</Link>
          </Button>
        )}
        {walkbookId && active ? (
          <Button asChild variant="outline">
            <Link href={`/app/map?walkbook=${walkbookId}`}>Back to map</Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function Stat({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="rounded-lg border border-border bg-white p-4 text-center shadow-sm">
      <p className="text-2xl font-semibold text-navy-900">{value}</p>
      {suffix ? <p className="text-[11px] text-navy-500">{suffix}</p> : null}
      <p className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
    </div>
  );
}
