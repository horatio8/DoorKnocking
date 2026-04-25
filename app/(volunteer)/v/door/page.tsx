"use client";

// Screen 7 — Contact result (Variant B, "Single screen")

import { useState } from "react";
import { useRouter } from "next/navigation";
import { T, fontInter } from "@/lib/volunteer/tokens";
import { loadSession, patchSession, type DoorOutcome } from "@/lib/volunteer/session";

const DOOR = {
  n: 8,
  line1: "1042 River Haven Cir",
  line2: "Charleston, SC",
  primary: "Patricia Mendez",
  household: ["Patricia Mendez", "Robert Mendez", "Maria Mendez (18)"],
};

const SUPPORT_LEVELS: { id: DoorOutcome; label: string; color: string; sub: string }[] = [
  { id: "strong-yes", label: "Strong yes", color: "#059669", sub: "Will vote, will tell others" },
  { id: "lean-yes", label: "Leaning yes", color: "#10B981", sub: "Probably with us" },
  { id: "undecided", label: "Undecided", color: "#F59E0B", sub: "Open, needs more info" },
  { id: "lean-no", label: "Leaning no", color: "#F97316", sub: "Probably against" },
  { id: "strong-no", label: "Strong no", color: "#DC2626", sub: "Won’t vote our way" },
];

const NON_CONTACT: { id: DoorOutcome; label: string; icon: "home" | "x" | "move" | "lang" }[] = [
  { id: "not-home", label: "Not home", icon: "home" },
  { id: "refused", label: "Refused to talk", icon: "x" },
  { id: "moved", label: "Moved / wrong address", icon: "move" },
  { id: "language", label: "Language barrier", icon: "lang" },
];

export default function DoorResultPage() {
  const router = useRouter();
  const [picked, setPicked] = useState<DoorOutcome | null>(null);

  const onSave = () => {
    if (!picked) return;
    const session = loadSession();
    patchSession({
      results: [
        ...session.results,
        { doorN: DOOR.n, outcome: picked, contactedAt: new Date().toISOString() },
      ],
    });
    router.push("/v/map");
  };

  return (
    <div
      style={{
        flex: 1,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        background: T.white,
        fontFamily: fontInter,
      }}
    >
      <Header onBack={() => router.push("/v/map")} />

      <div style={{ padding: "4px 16px 0" }}>
        <h1
          style={{
            margin: "8px 0 0",
            fontWeight: 700,
            fontSize: 24,
            lineHeight: "30px",
            letterSpacing: "-0.01em",
            color: T.navy900,
            textWrap: "balance" as const,
          }}
        >
          What happened?
        </h1>
      </div>

      <div style={{ padding: "14px 16px 0", flex: 1, overflow: "auto" }}>
        <Overline>Talked to someone</Overline>
        <div
          style={{
            marginTop: 8,
            padding: "12px 14px",
            background: T.slate50,
            border: `1px solid ${T.slate100}`,
            borderRadius: 10,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke={T.slate500}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          <select
            aria-label="Who answered the door"
            defaultValue={DOOR.primary}
            style={{
              flex: 1,
              border: "none",
              background: "transparent",
              fontFamily: fontInter,
              fontSize: 14,
              fontWeight: 500,
              color: T.navy900,
              appearance: "none",
            }}
          >
            {DOOR.household.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke={T.slate500}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>

        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          {SUPPORT_LEVELS.map((lvl) => {
            const on = picked === lvl.id;
            return (
              <button
                key={lvl.id}
                onClick={() => setPicked(lvl.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "14px 16px",
                  background: lvl.color,
                  border: `2px solid ${on ? "#0A1628" : "transparent"}`,
                  borderRadius: 10,
                  cursor: "pointer",
                  textAlign: "left",
                  color: T.white,
                  boxShadow: on
                    ? "0 4px 14px rgba(10,22,40,0.25)"
                    : "0 1px 2px rgba(15,23,42,0.08)",
                  transform: on ? "translateY(-1px)" : "none",
                  transition: "transform 100ms, box-shadow 100ms",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.005em" }}>
                    {lvl.label}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.85, marginTop: 1 }}>{lvl.sub}</div>
                </div>
                {on && (
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      background: T.white,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={lvl.color}
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div style={{ marginTop: 18 }}>
          <Overline>Didn&rsquo;t talk</Overline>
          <div
            style={{
              marginTop: 8,
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
            }}
          >
            {NON_CONTACT.map((nc) => {
              const on = picked === nc.id;
              return (
                <button
                  key={nc.id}
                  onClick={() => setPicked(nc.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "14px 14px",
                    background: on ? T.navy800 : T.navy50,
                    border: `2px solid ${on ? T.navy900 : "transparent"}`,
                    borderRadius: 10,
                    cursor: "pointer",
                    textAlign: "left",
                    color: on ? T.white : T.navy800,
                    boxShadow: on ? "0 4px 14px rgba(10,22,40,0.18)" : "none",
                    transition: "all 100ms",
                  }}
                >
                  <NCIcon name={nc.icon} />
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{nc.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{ padding: "12px 16px 24px", borderTop: `1px solid ${T.slate100}` }}>
        <button
          onClick={onSave}
          disabled={!picked}
          style={{
            width: "100%",
            height: 52,
            padding: "0 20px",
            background: picked ? T.crimson600 : T.slate200,
            color: picked ? T.white : T.slate500,
            border: `1px solid ${picked ? T.crimson600 : T.slate200}`,
            borderRadius: 8,
            fontFamily: fontInter,
            fontWeight: 600,
            fontSize: 16,
            letterSpacing: "-0.005em",
            cursor: picked ? "pointer" : "not-allowed",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          Save and continue
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12h14M13 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function Header({ onBack }: { onBack: () => void }) {
  return (
    <div style={{ padding: "52px 16px 12px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={onBack}
          aria-label="Back"
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            background: T.white,
            border: `1px solid ${T.slate200}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke={T.navy700}
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Overline>Door {DOOR.n} &middot; logging</Overline>
          <div
            style={{
              marginTop: 2,
              fontSize: 15,
              fontWeight: 600,
              color: T.navy900,
              letterSpacing: "-0.005em",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {DOOR.line1}
          </div>
        </div>
      </div>
    </div>
  );
}

function Overline({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: fontInter,
        fontWeight: 600,
        fontSize: 11,
        lineHeight: "16px",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: T.slate500,
      }}
    >
      {children}
    </div>
  );
}

function NCIcon({ name }: { name: "home" | "x" | "move" | "lang" }) {
  const props = {
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (name === "home")
    return (
      <svg {...props}>
        <path d="M3 12l9-9 9 9M5 10v10h14V10" />
      </svg>
    );
  if (name === "x")
    return (
      <svg {...props}>
        <path d="M18 6L6 18M6 6l12 12" />
      </svg>
    );
  if (name === "move")
    return (
      <svg {...props}>
        <path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20" />
      </svg>
    );
  return (
    <svg {...props}>
      <path d="M5 8h11M9 4l5 12M2 20l4-8 4 8M14 12h7M17 9c0 4 3 7 4 8M21 9c0 4-3 7-4 8" />
    </svg>
  );
}
