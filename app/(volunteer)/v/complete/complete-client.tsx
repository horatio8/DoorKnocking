"use client";

// Screen 8 — Walkbook complete (Variant B, "Confetti hero")

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { T, fontInter, fontSerif } from "@/lib/volunteer/tokens";
import type { SessionSummary } from "@/lib/volunteer/load-summary";

const BUCKET_LABEL: Record<string, string> = {
  tonight: "tonight after 6 PM",
  tomorrow: "tomorrow morning",
  weekend: "this weekend",
  later: "in about a week",
};

export function CompleteClient({
  firstName,
  summary,
}: {
  firstName: string;
  summary: SessionSummary;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onAnother = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      if (summary.sessionId) {
        await fetch("/api/knocker/session", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: summary.sessionId, end: true }),
        });
      }
      router.push("/v/time");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  };

  const onDone = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      if (summary.sessionId) {
        await fetch("/api/knocker/session", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: summary.sessionId, end: true }),
        });
      }
      router.push("/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
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
      <ConfettiHero contacts={summary.contacts} />

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
          .{" "}
          {summary.walkbookName ? (
            <>You finished {summary.walkbookName}.</>
          ) : (
            <>That&rsquo;s a wrap on this session.</>
          )}
        </div>

        <div style={{ height: 8 }} />

        <div style={{ display: "flex", gap: 8 }}>
          <Stat k="Doors" v={summary.doorsKnocked} />
          <Stat k="Time" v={`${summary.durationMins}m`} />
          <Stat k="Supportive" v={summary.supportive} />
        </div>

        <div style={{ height: 20 }} />
        <Overline>Outcomes</Overline>
        <div style={{ height: 10 }} />
        <ContactBar summary={summary} />

        {summary.commitments.length > 0 ? (
          <div style={{ marginTop: 24 }}>
            <Overline>Coming back later</Overline>
            <div style={{ height: 10 }} />
            <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
              {summary.commitments.map((c) => (
                <li
                  key={c.id}
                  style={{ fontSize: 14, color: T.navy800, padding: "4px 0" }}
                >
                  &middot; {c.addressLine1 ?? "Address pending"}{" "}
                  <span style={{ color: T.slate500 }}>
                    {BUCKET_LABEL[c.bucket] ?? "later"}
                  </span>
                </li>
              ))}
            </ul>
            <div
              style={{
                marginTop: 8,
                fontStyle: "italic",
                fontSize: 12,
                color: T.slate500,
              }}
            >
              We&rsquo;ll remind you.
            </div>
          </div>
        ) : null}

        <div style={{ flex: 1, minHeight: 16 }} />

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

        <div
          style={{
            padding: "14px 0 22px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <Btn variant="primary" onClick={onAnother} disabled={submitting}>
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
          <Btn variant="secondary" onClick={onDone} disabled={submitting}>
            I&rsquo;m done for today
          </Btn>
        </div>
      </div>
    </div>
  );
}

function ConfettiHero({ contacts }: { contacts: number }) {
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
          {contacts === 1 ? "real conversation today." : "real conversations today."}
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

function ContactBar({ summary }: { summary: SessionSummary }) {
  const segs = [
    { key: "supportive", n: summary.supportive, color: T.emerald600, label: "Supportive" },
    { key: "undecided", n: summary.undecided, color: T.amber500, label: "Undecided" },
    { key: "not_supportive", n: summary.notSupportive, color: T.crimson500, label: "Not supportive" },
    { key: "no_answer", n: summary.noAnswer, color: "#94A3B8", label: "No answer" },
    { key: "come_back_later", n: summary.comeBackLater, color: "#F97316", label: "Come back later" },
    { key: "refused", n: summary.refused, color: "#475569", label: "Refused" },
  ].filter((s) => s.n > 0);

  if (segs.length === 0) {
    return (
      <div style={{ fontSize: 13, color: T.slate500 }}>
        No knocks logged yet — start a session to log your first one.
      </div>
    );
  }

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
          <div
            key={s.key}
            style={{ display: "flex", alignItems: "center", fontSize: 13 }}
          >
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
  disabled,
}: {
  variant: "primary" | "secondary";
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const s =
    variant === "primary"
      ? { bg: T.crimson600, fg: T.white, br: T.crimson600 }
      : { bg: T.white, fg: T.navy900, br: T.slate200 };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
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
        cursor: disabled ? "wait" : "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        opacity: disabled ? 0.7 : 1,
      }}
    >
      {children}
    </button>
  );
}
