"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { T, fontInter } from "@/lib/volunteer/tokens";

const TIME_OPTIONS: { label: string; minutes: number; hint: string }[] = [
  { label: "30 minutes", minutes: 30, hint: "~6 doors" },
  { label: "1 hour", minutes: 60, hint: "~12 doors" },
  { label: "2 hours", minutes: 120, hint: "~24 doors" },
  { label: "3 hours", minutes: 180, hint: "~36 doors" },
  { label: "All day", minutes: 480, hint: "as many as you like" },
];

export function TimeClient({ initialMinutes }: { initialMinutes: number | null }) {
  const router = useRouter();
  const [selected, setSelected] = useState<number | null>(initialMinutes);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const choose = async (minutes: number) => {
    if (submitting) return;
    setSelected(minutes);
    setSubmitting(true);
    setError(null);
    try {
      // Save the chip preference for tomorrow's pre-select.
      const profileRes = await fetch("/api/knocker/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ next_session_minutes: minutes }),
      });
      if (!profileRes.ok) {
        const profileBody = (await profileRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(profileBody.error ?? "Couldn't save your time. Try again.");
      }

      // Best-effort GPS for proximity scoring; falls back to district centroid.
      const gps = await readCurrentGps();

      const queueRes = await fetch("/api/queue/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_minutes: minutes,
          gps,
          replace_existing: true,
        }),
      });
      if (!queueRes.ok) {
        const queueBody = (await queueRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(queueBody.error ?? "Couldn't build your route. Try again.");
      }
      const { walkbook_id } = (await queueRes.json()) as { walkbook_id: string };
      router.push(`/v/walkbook?wb=${walkbook_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  };

  const readCurrentGps = (): Promise<{ lat: number; lng: number } | null> =>
    new Promise((resolve) => {
      if (typeof navigator === "undefined" || !navigator.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: false, timeout: 4000, maximumAge: 60_000 },
      );
    });

  return (
    <div
      style={{
        flex: 1,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        padding: "64px 16px 24px",
        background: T.white,
        fontFamily: fontInter,
      }}
    >
      <div style={{ padding: "0 8px" }}>
        <h1
          style={{
            margin: 0,
            fontWeight: 700,
            fontSize: 28,
            lineHeight: "36px",
            letterSpacing: "-0.02em",
            color: T.navy900,
          }}
        >
          How long do you
          <br />
          have today?
        </h1>
        <p style={{ margin: "8px 0 0", fontSize: 14, lineHeight: "20px", color: T.slate600 }}>
          We&rsquo;ll size your route to fit. Doors are rough estimates.
        </p>
      </div>

      <div style={{ height: 24 }} />

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {TIME_OPTIONS.map((opt) => (
          <Chip
            key={opt.minutes}
            opt={opt}
            active={selected === opt.minutes}
            disabled={submitting}
            onClick={() => choose(opt.minutes)}
          />
        ))}
      </div>

      <div style={{ flex: 1 }} />

      {error ? (
        <div
          role="alert"
          style={{
            marginBottom: 8,
            padding: "8px 12px",
            borderRadius: 8,
            background: T.crimson50,
            border: `1px solid ${T.crimson100}`,
            color: T.crimson700,
            fontSize: 13,
          }}
        >
          {error}
        </div>
      ) : null}

      <div style={{ padding: "0 8px", fontSize: 12, lineHeight: "16px", color: T.slate500 }}>
        Tap a time. We&rsquo;ll fit your route to it.
      </div>
    </div>
  );
}

function Chip({
  opt,
  active,
  disabled,
  onClick,
}: {
  opt: { label: string; minutes: number; hint: string };
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "100%",
        height: 64,
        padding: "0 20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: active ? T.crimson50 : T.white,
        border: `1px solid ${active ? T.crimson600 : T.slate200}`,
        borderRadius: 12,
        fontFamily: fontInter,
        cursor: disabled ? "wait" : "pointer",
        textAlign: "left",
        transition: "background 100ms, border-color 100ms",
        opacity: disabled && !active ? 0.6 : 1,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span
          style={{
            fontWeight: 600,
            fontSize: 16,
            letterSpacing: "-0.005em",
            color: active ? T.crimson700 : T.navy900,
          }}
        >
          {opt.label}
        </span>
        <span style={{ fontSize: 13, color: active ? T.crimson600 : T.slate500 }}>{opt.hint}</span>
      </div>
      <div
        style={{
          width: 22,
          height: 22,
          borderRadius: 11,
          border: `1.5px solid ${active ? T.crimson600 : T.slate200}`,
          background: active ? T.crimson600 : T.white,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {active ? (
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 13l4 4L19 7" />
          </svg>
        ) : null}
      </div>
    </button>
  );
}
