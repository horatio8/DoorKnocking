"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const COMMITMENT_OPTIONS: Array<{ key: "one_time" | "few_sessions" | "regular" | "unknown"; label: string }> = [
  { key: "one_time", label: "Just this one time" },
  { key: "few_sessions", label: "A few sessions" },
  { key: "regular", label: "Regularly through the campaign" },
  { key: "unknown", label: "Not sure yet" },
];

const SESSION_OPTIONS = [30, 60, 120, 180, 240];

export function WelcomeCards({
  clientName,
  districtName,
  adminPhone,
  initialCommitment,
  initialSessionMinutes,
  gpsConsent,
}: {
  clientName: string;
  districtName: string;
  adminPhone: string | null;
  initialCommitment: string | null;
  initialSessionMinutes: number | null;
  gpsConsent: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = useState<0 | 1 | 2 | 3 | 4>(0);
  const [commitment, setCommitment] = useState<string | null>(initialCommitment);
  const [sessionMinutes, setSessionMinutes] = useState<number | null>(initialSessionMinutes ?? 60);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function finish() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/knocker/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          completed_welcome: true,
          commitment_level: commitment,
          next_session_minutes: sessionMinutes,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? `${res.status}`);
      // Next stop: GPS consent if not granted, else walkbook browse.
      router.replace(gpsConsent ? "/app/walkbooks/browse" : "/app/gps-consent");
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const cards = [
    {
      title: "What you'll be doing",
      body: (
        <>
          <p>
            You&apos;ll knock on doors in <strong>{districtName}</strong> for{" "}
            <strong>{clientName}</strong>. Each time someone answers (or doesn&apos;t), you&apos;ll
            log what happened. The app tracks your progress and gives you the next house to visit.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Most volunteers knock 10–20 doors per hour.
          </p>
        </>
      ),
    },
    {
      title: "What to say",
      body: (
        <>
          <p>
            Your campaign&apos;s full script loads once you start knocking. Don&apos;t worry about
            memorising it — you can glance at it any time from the map.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Pace yourself. It&apos;s a conversation, not a pitch.
          </p>
        </>
      ),
    },
    {
      title: "Safety & etiquette",
      body: (
        <ul className="space-y-1 text-sm">
          <li>• Knock, then step back ~3 feet.</li>
          <li>• If no one answers, log &quot;no answer&quot; and move on.</li>
          <li>• Never enter someone&apos;s home.</li>
          <li>• If someone is hostile, leave — log &quot;refused&quot; and go.</li>
          {adminPhone ? (
            <li>
              • Campaign contact: <strong>{adminPhone}</strong>
            </li>
          ) : null}
        </ul>
      ),
    },
    {
      title: "How much time can you help overall?",
      body: (
        <div className="space-y-2">
          {COMMITMENT_OPTIONS.map((opt) => (
            <label
              key={opt.key}
              className={`flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm ${
                commitment === opt.key
                  ? "border-navy-900 bg-navy-50"
                  : "border-navy-200 bg-white"
              }`}
            >
              <input
                type="radio"
                name="commitment"
                checked={commitment === opt.key}
                onChange={() => setCommitment(opt.key)}
              />
              {opt.label}
            </label>
          ))}
        </div>
      ),
    },
    {
      title: "How long do you have today?",
      body: (
        <div>
          <div className="flex flex-wrap gap-1.5">
            {SESSION_OPTIONS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setSessionMinutes(m)}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${
                  sessionMinutes === m
                    ? "border-navy-900 bg-navy-900 text-white"
                    : "border-navy-200 bg-white text-navy-700"
                }`}
              >
                {m < 60 ? `${m}m` : m === 240 ? "4h+" : `${m / 60}h`}
              </button>
            ))}
            <input
              type="number"
              min={5}
              max={480}
              step={15}
              value={sessionMinutes ?? 0}
              onChange={(e) => setSessionMinutes(Number(e.target.value))}
              className="w-20 rounded-full border border-navy-200 px-2 py-1 text-center text-xs"
              aria-label="Custom minutes"
            />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            You can change this any time. It&apos;s just used to filter walkbooks that fit your
            window.
          </p>
        </div>
      ),
    },
  ];

  const last = step === cards.length - 1;

  return (
    <div className="mx-auto flex h-full max-w-md flex-col p-4">
      <p className="text-xs uppercase tracking-widest text-navy-500">
        Welcome · Step {step + 1} of {cards.length}
      </p>
      <h1 className="mt-1 font-serif text-2xl font-semibold text-navy-900">
        {cards[step].title}
      </h1>
      <div className="mt-4 flex-1 rounded-lg border border-border bg-white p-4 text-sm text-navy-900">
        {cards[step].body}
      </div>

      {error ? (
        <p className="mt-2 rounded bg-crimson/10 px-3 py-2 text-xs text-crimson">{error}</p>
      ) : null}

      <div className="mt-4 flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          onClick={() => setStep((s) => (s > 0 ? ((s - 1) as 0 | 1 | 2 | 3 | 4) : s))}
          disabled={step === 0}
        >
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
        </Button>
        {last ? (
          <Button onClick={finish} disabled={busy} variant="accent">
            {busy ? "Saving…" : "I'm ready — let's go"} <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        ) : (
          <Button
            onClick={() => setStep((s) => ((s + 1) as 0 | 1 | 2 | 3 | 4))}
            variant="accent"
          >
            Next <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
