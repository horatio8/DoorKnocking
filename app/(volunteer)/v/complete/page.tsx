"use client";

// Screen 8 — Walkbook complete (Variant B, "Confetti hero")
// This is the screen the design handoff opens with (Complete.html).

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { T, fontInter, fontSerif } from "@/lib/volunteer/tokens";
import { loadSession, resetSession, type DoorOutcome } from "@/lib/volunteer/session";

type SummaryCounts = {
  doors: number;
  contacts: number;
  strongYes: number;
  leanYes: number;
  undecided: number;
  leanNo: number;
  strongNo: number;
  notHome: number;
  refused: number;
};

const FALLBACK: SummaryCounts = {
  doors: 18,
  contacts: 11,
  strongYes: 4,
  leanYes: 3,
  undecided: 2,
  leanNo: 1,
  strongNo: 1,
  notHome: 5,
  refused: 2,
};

export default function CompletePage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("James");
  const [walkbookName, setWalkbookName] = useState("Riverland Woods");
  const [durationMins, setDurationMins] = useState(68);
  const [counts, setCounts] = useState<SummaryCounts>(FALLBACK);

  useEffect(() => {
    const s = loadSession();
    setFirstName(s.firstName);
    setWalkbookName(s.walkbookName);

    if (s.startedAt) {
      const minutes = Math.max(
        1,
        Math.round((Date.now() - new Date(s.startedAt).getTime()) / 60000)
      );
      setDurationMins(minutes);
    }

    if (s.results.length > 0) {
      const tally = s.results.reduce<Record<DoorOutcome, number>>(
        (acc, r) => {
          acc[r.outcome] = (acc[r.outcome] ?? 0) + 1;
          return acc;
        },
        {
          "strong-yes": 0,
          "lean-yes": 0,
          undecided: 0,
          "lean-no": 0,
          "strong-no": 0,
          "not-home": 0,
          refused: 0,
          moved: 0,
          language: 0,
        }
      );
      const contacts =
        tally["strong-yes"] +
        tally["lean-yes"] +
        tally.undecided +
        tally["lean-no"] +
        tally["strong-no"];
      setCounts({
        doors: s.results.length,
        contacts,
        strongYes: tally["strong-yes"],
        leanYes: tally["lean-yes"],
        undecided: tally.undecided,
        leanNo: tally["lean-no"],
        strongNo: tally["strong-no"],
        notHome: tally["not-home"],
        refused: tally.refused + tally.moved + tally.language,
      });
    }
  }, []);

  const onAnother = () => {
    resetSession();
    router.push("/v/time");
  };
  const onDone = () => {
    resetSession();
    router.push("/v/welcome");
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
      <ConfettiHero contacts={counts.contacts} />

      <div
        style={{
          flex: 1,
          padding: "20px 20px 0",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ marginBottom: 6, fontSize: 15, color: T.slate600 }}>
          Thanks,{" "}
          <span style={{ fontFamily: fontSerif, fontWeight: 600, color: T.navy900 }}>
            {firstName}
          </span>
          . You finished {walkbookName}.
        </div>

        <div style={{ height: 8 }} />

        <div style={{ display: "flex", gap: 8 }}>
          <Stat k="Doors" v={counts.doors} />
          <Stat k="Time" v={`${durationMins}m`} />
          <Stat k="Strong yes" v={counts.strongYes} />
        </div>

        <div style={{ height: 20 }} />
        <Overline>Outcomes</Overline>
        <div style={{ height: 10 }} />
        <ContactBar data={counts} />

        <div style={{ flex: 1, minHeight: 16 }} />

        <div
          style={{
            padding: "14px 0 22px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <Btn variant="primary" onClick={onAnother}>
            Take another walkbook
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
          </Btn>
          <Btn variant="secondary" onClick={onDone}>
            I&rsquo;m done for today
          </Btn>
        </div>
      </div>
    </div>
  );
}

function ConfettiHero({ contacts }: { contacts: number }) {
  // Pre-compute deterministic star positions so the SSR + hydration markup match.
  const stars = useMemo(() => {
    return Array.from({ length: 28 }).map((_, i) => {
      const x = (i * 53) % 360;
      const y = (i * 71) % 220;
      const r = 4 + (i % 3) * 1.5;
      const rot = (i * 47) % 360;
      return { x, y, r, rot };
    });
  }, []);

  return (
    <div
      style={{
        padding: "60px 24px 32px",
        background: `linear-gradient(165deg, ${T.crimson600} 0%, #7F1D1D 100%)`,
        color: T.white,
        position: "relative",
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 360 220"
        preserveAspectRatio="none"
        style={{ position: "absolute", inset: 0, opacity: 0.45 }}
        aria-hidden="true"
      >
        {stars.map((s, i) => (
          <g key={i} transform={`rotate(${s.rot} ${s.x} ${s.y})`}>
            <Star cx={s.x} cy={s.y} r={s.r} fill="#FFFFFF" />
          </g>
        ))}
      </svg>
      <div style={{ position: "relative" }}>
        <Overline color="rgba(255,255,255,0.7)">Walkbook complete</Overline>
        <div
          style={{
            marginTop: 8,
            fontFamily: fontSerif,
            fontWeight: 600,
            fontSize: 64,
            lineHeight: "64px",
            letterSpacing: "-0.03em",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {contacts}
        </div>
        <div
          style={{
            marginTop: 6,
            fontSize: 17,
            fontWeight: 500,
            opacity: 0.95,
            textWrap: "balance" as const,
          }}
        >
          real conversations today.
        </div>
        <div style={{ marginTop: 4, fontSize: 14, opacity: 0.8 }}>
          That&rsquo;s {contacts} more than yesterday.
        </div>
      </div>
    </div>
  );
}

function Star({ cx, cy, r, fill }: { cx: number; cy: number; r: number; fill: string }) {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    const radius = i % 2 === 0 ? r : r * 0.4;
    pts.push(`${cx + Math.cos(angle) * radius},${cy + Math.sin(angle) * radius}`);
  }
  return <polygon points={pts.join(" ")} fill={fill} />;
}

function Stat({ k, v }: { k: string; v: string | number }) {
  return (
    <div
      style={{
        flex: 1,
        padding: "12px 14px",
        border: `1px solid ${T.slate200}`,
        borderRadius: 12,
        background: T.white,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: T.slate500,
        }}
      >
        {k}
      </div>
      <div
        style={{
          marginTop: 4,
          fontWeight: 600,
          fontSize: 24,
          lineHeight: "28px",
          color: T.navy900,
          fontFamily: fontSerif,
          letterSpacing: "-0.01em",
        }}
      >
        {v}
      </div>
    </div>
  );
}

function ContactBar({ data }: { data: SummaryCounts }) {
  const segs = [
    { key: "strong-yes", n: data.strongYes, color: "#059669", label: "Strong yes" },
    { key: "lean-yes", n: data.leanYes, color: "#10B981", label: "Lean yes" },
    { key: "undecided", n: data.undecided, color: "#F59E0B", label: "Undecided" },
    { key: "lean-no", n: data.leanNo, color: "#F97316", label: "Lean no" },
    { key: "strong-no", n: data.strongNo, color: "#DC2626", label: "Strong no" },
    { key: "not-home", n: data.notHome, color: "#94A3B8", label: "Not home" },
    { key: "refused", n: data.refused, color: "#475569", label: "Refused" },
  ].filter((s) => s.n > 0);
  return (
    <div>
      <div
        style={{
          display: "flex",
          height: 12,
          borderRadius: 6,
          overflow: "hidden",
          border: `1px solid ${T.slate100}`,
        }}
      >
        {segs.map((s) => (
          <div key={s.key} style={{ flex: s.n, background: s.color }} />
        ))}
      </div>
      <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
        {segs.map((s) => (
          <div key={s.key} style={{ display: "flex", alignItems: "center", fontSize: 13 }}>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                background: s.color,
                marginRight: 8,
              }}
            />
            <span style={{ flex: 1, color: T.slate700 }}>{s.label}</span>
            <span
              style={{
                color: T.navy900,
                fontWeight: 600,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {s.n}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Overline({
  children,
  color = T.slate500,
}: {
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <div
      style={{
        fontFamily: fontInter,
        fontWeight: 600,
        fontSize: 11,
        lineHeight: "16px",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color,
      }}
    >
      {children}
    </div>
  );
}

function Btn({
  variant,
  children,
  onClick,
}: {
  variant: "primary" | "secondary";
  children: React.ReactNode;
  onClick?: () => void;
}) {
  const s =
    variant === "primary"
      ? { bg: T.crimson600, fg: T.white, br: T.crimson600 }
      : { bg: T.white, fg: T.navy900, br: T.slate200 };
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        height: 52,
        padding: "0 20px",
        background: s.bg,
        color: s.fg,
        border: `1px solid ${s.br}`,
        borderRadius: 8,
        fontFamily: fontInter,
        fontWeight: 600,
        fontSize: 16,
        letterSpacing: "-0.005em",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
      }}
    >
      {children}
    </button>
  );
}
