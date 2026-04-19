"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const COMMITMENT_OPTIONS: Array<{
  key: "one_time" | "few_sessions" | "regular" | "unknown";
  label: string;
  helper: string;
}> = [
  { key: "one_time", label: "Just this one time", helper: "A single session" },
  { key: "few_sessions", label: "A few sessions", helper: "Two or three days" },
  { key: "regular", label: "Regularly", helper: "Through the campaign" },
  { key: "unknown", label: "Not sure yet", helper: "Decide later" },
];

const SESSION_OPTIONS = [30, 60, 120, 180, 240];

type Step = 0 | 1;

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
  const [step, setStep] = useState<Step>(0);
  const [commitment, setCommitment] = useState<string | null>(initialCommitment);
  const [sessionMinutes, setSessionMinutes] = useState<number>(initialSessionMinutes ?? 60);
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
      router.replace(gpsConsent ? "/app/walkbooks/browse" : "/app/gps-consent");
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex h-full max-w-md flex-col px-4 pb-4 pt-3">
      <p className="text-[11px] uppercase tracking-widest text-navy-500">
        Welcome · Step {step + 1} of 2
      </p>

      <div className="mt-2 flex-1 overflow-y-auto">
        {step === 0 ? (
          <TimePage
            commitment={commitment}
            onCommitment={setCommitment}
            sessionMinutes={sessionMinutes}
            onSessionMinutes={setSessionMinutes}
          />
        ) : (
          <IntroPage
            clientName={clientName}
            districtName={districtName}
            adminPhone={adminPhone}
          />
        )}
      </div>

      {error ? (
        <p className="mt-2 rounded bg-crimson/10 px-3 py-2 text-xs text-crimson">{error}</p>
      ) : null}

      <div className="mt-3 flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="lg"
          onClick={() => setStep(0)}
          disabled={step === 0}
        >
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
        </Button>
        {step === 0 ? (
          <Button
            size="lg"
            variant="accent"
            onClick={() => setStep(1)}
            disabled={!commitment || !sessionMinutes}
          >
            Next <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        ) : (
          <Button size="lg" onClick={finish} disabled={busy} variant="accent">
            {busy ? "Saving…" : "I'm ready"} <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

function TimePage({
  commitment,
  onCommitment,
  sessionMinutes,
  onSessionMinutes,
}: {
  commitment: string | null;
  onCommitment: (v: string) => void;
  sessionMinutes: number;
  onSessionMinutes: (m: number) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-navy-900">How much can you help?</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Two quick questions so we can suggest the right walkbooks.
        </p>
      </div>

      <section>
        <p className="mb-2 text-sm font-semibold text-navy-900">Overall, how much time do you have?</p>
        <div className="grid grid-cols-2 gap-2">
          {COMMITMENT_OPTIONS.map((opt) => {
            const active = commitment === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => onCommitment(opt.key)}
                className={`flex min-h-[88px] flex-col items-start justify-center rounded-xl border-2 px-3 py-3 text-left transition active:scale-[0.98] ${
                  active
                    ? "border-navy-900 bg-navy-900 text-white"
                    : "border-navy-200 bg-white text-navy-900"
                }`}
              >
                <span className="text-base font-semibold leading-tight">{opt.label}</span>
                <span
                  className={`mt-1 text-xs ${active ? "text-white/70" : "text-muted-foreground"}`}
                >
                  {opt.helper}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <p className="mb-2 text-sm font-semibold text-navy-900">How long do you have today?</p>
        <div className="grid grid-cols-3 gap-2">
          {SESSION_OPTIONS.map((m) => {
            const active = sessionMinutes === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => onSessionMinutes(m)}
                className={`flex min-h-[64px] items-center justify-center rounded-xl border-2 text-base font-semibold transition active:scale-[0.98] ${
                  active
                    ? "border-navy-900 bg-navy-900 text-white"
                    : "border-navy-200 bg-white text-navy-900"
                }`}
              >
                {m < 60 ? `${m}m` : m === 240 ? "4h+" : `${m / 60}h`}
              </button>
            );
          })}
        </div>
        <label className="mt-3 block">
          <span className="text-xs text-muted-foreground">Or enter minutes</span>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={sessionMinutes}
            onChange={(e) => {
              const n = Number(e.target.value.replace(/[^0-9]/g, ""));
              onSessionMinutes(Number.isFinite(n) ? n : 0);
            }}
            className="mt-1 h-12 w-full rounded-xl border-2 border-navy-200 bg-white px-3 text-center text-lg font-semibold text-navy-900"
            aria-label="Custom minutes"
          />
        </label>
      </section>
    </div>
  );
}

function IntroPage({
  clientName,
  districtName,
  adminPhone,
}: {
  clientName: string;
  districtName: string;
  adminPhone: string | null;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-navy-900">A quick how-to</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          You&apos;ll knock for <strong>{clientName}</strong> in <strong>{districtName}</strong>.
        </p>
      </div>

      <div className="space-y-3 rounded-xl border border-border bg-white p-4 text-sm text-navy-900">
        <Block title="What you'll do">
          The app gives you the next house. After each knock, log what happened — answered, no
          answer, come back, refused. Most volunteers manage 10–20 doors per hour.
        </Block>
        <Block title="What to say">
          Your campaign script appears on each household. Don&apos;t memorise — glance whenever
          you need it. Pace yourself; it&apos;s a conversation, not a pitch.
        </Block>
        <Block title="Stay safe">
          <ul className="mt-1 space-y-1 text-sm">
            <li>• Knock, then step back ~3 feet.</li>
            <li>• If no one answers, log &quot;no answer&quot; and move on.</li>
            <li>• Never enter someone&apos;s home.</li>
            <li>• If someone is hostile, log &quot;refused&quot; and walk away.</li>
            {adminPhone ? (
              <li>
                • Campaign contact: <strong>{adminPhone}</strong>
              </li>
            ) : null}
          </ul>
        </Block>
      </div>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest text-navy-500">{title}</p>
      <div className="mt-1 leading-snug">{children}</div>
    </div>
  );
}
