"use client";

// Screen 3 — Time chips (Variant B, "Door estimates")

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { T, fontInter } from "@/lib/volunteer/tokens";
import { loadSession, patchSession } from "@/lib/volunteer/session";

const TIME_OPTIONS: { label: string; minutes: number; hint: string }[] = [
  { label: "30 minutes", minutes: 30, hint: "~6 doors" },
  { label: "1 hour", minutes: 60, hint: "~12 doors" },
  { label: "2 hours", minutes: 120, hint: "~24 doors" },
  { label: "3 hours", minutes: 180, hint: "~36 doors" },
  { label: "All day", minutes: 480, hint: "as many as you like" },
];

export default function TimeChipsPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    setSelected(loadSession().selectedMinutes);
  }, []);

  const choose = (minutes: number) => {
    setSelected(minutes);
    patchSession({ selectedMinutes: minutes });
    // Tapping a chip IS the action — auto-advance after a short visual confirm.
    window.setTimeout(() => router.push("/v/walkbook"), 200);
  };

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
            onClick={() => choose(opt.minutes)}
          />
        ))}
      </div>

      <div style={{ flex: 1 }} />

      <div style={{ padding: "16px 8px 0", fontSize: 12, lineHeight: "16px", color: T.slate500 }}>
        Tap a time. We&rsquo;ll fit your route to it.
      </div>
    </div>
  );
}

function Chip({
  opt,
  active,
  onClick,
}: {
  opt: { label: string; minutes: number; hint: string };
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
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
        cursor: "pointer",
        textAlign: "left",
        transition: "background 100ms, border-color 100ms",
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
        {active && (
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
        )}
      </div>
    </button>
  );
}
