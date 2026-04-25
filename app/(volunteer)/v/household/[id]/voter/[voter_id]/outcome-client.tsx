"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, HelpCircle, X as XIcon, type LucideIcon } from "lucide-react";
import { T, fontInter, fontSerif } from "@/lib/volunteer/tokens";

type Outcome = "supportive" | "undecided" | "not_supportive";

const OUTCOMES: { id: Outcome; label: string; color: string; bg: string; Icon: LucideIcon }[] = [
  { id: "supportive", label: "Supportive", color: T.emerald600, bg: T.emerald50, Icon: Check },
  { id: "undecided", label: "Undecided", color: T.amber500, bg: "#FFFBEB", Icon: HelpCircle },
  { id: "not_supportive", label: "Not supportive", color: T.crimson500, bg: T.crimson50, Icon: XIcon },
];

const COME_BACK_BUCKETS = [
  { id: "tonight", label: "Tonight after 6 PM" },
  { id: "tomorrow", label: "Tomorrow morning" },
  { id: "weekend", label: "This weekend" },
  { id: "later", label: "Just sometime later" },
] as const;

export function OutcomeClient({
  householdId,
  voterId,
  voterName,
  walkbookId,
}: {
  householdId: string;
  voterId: string;
  voterName: string;
  walkbookId: string | null;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comeBackOpen, setComeBackOpen] = useState(false);
  const [toast, setToast] = useState<{ name: string; outcome: string; eventId: string } | null>(
    null,
  );

  const logEvent = async (status: string, notes: string | null = null) => {
    const id = crypto.randomUUID();
    const res = await fetch("/api/knocker/knock-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        client_event_id: id,
        household_id: householdId,
        voter_id: voterId,
        walkbook_id: walkbookId,
        status,
        knocked_at: new Date().toISOString(),
        notes,
      }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error ?? "Couldn't save the result. Try again.");
    }
    return id;
  };

  const onOutcome = async (o: (typeof OUTCOMES)[number]) => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const id = await logEvent("contacted", `outcome:${o.id}`);
      setToast({ name: voterName, outcome: o.label.toLowerCase(), eventId: id });
      // Auto-route after the toast has had a moment.
      window.setTimeout(() => {
        router.push("/v/map");
        router.refresh();
      }, 700);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  };

  const onRefused = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await logEvent("refused");
      router.push("/v/map");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  };

  const onComeBack = async (bucket: (typeof COME_BACK_BUCKETS)[number]["id"]) => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const knockEventId = await logEvent("come_back_later", `come_back:${bucket}`);
      // Best-effort commitment write. Failures don't block the flow.
      await fetch("/api/knocker/commitment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          household_id: householdId,
          voter_id: voterId,
          knock_event_id: knockEventId,
          bucket,
        }),
      }).catch(() => null);
      router.push("/v/map");
      router.refresh();
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
        padding: "16px 16px 16px",
        background: T.white,
        fontFamily: fontInter,
        color: T.navy900,
        position: "relative",
      }}
    >
      <button
        onClick={() => router.push(`/v/household/${householdId}`)}
        aria-label="Back to house"
        style={{
          alignSelf: "flex-start",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          color: T.navy900,
          fontFamily: fontInter,
          fontWeight: 500,
          fontSize: 14,
          padding: "4px 4px",
        }}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Back to house
      </button>

      <div style={{ height: 16 }} />

      <h1
        style={{
          margin: 0,
          fontWeight: 700,
          fontSize: 26,
          lineHeight: "32px",
          letterSpacing: "-0.02em",
        }}
      >
        Talking to{" "}
        <span style={{ fontFamily: fontSerif, fontWeight: 600, fontSize: 26 }}>{voterName}</span>
      </h1>

      <div style={{ height: 16 }} />

      <div style={{ fontSize: 16, color: T.slate700 }}>How did it go?</div>

      <div style={{ height: 24 }} />

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {OUTCOMES.map((o) => (
          <OutcomeButton key={o.id} outcome={o} onClick={() => onOutcome(o)} disabled={submitting} />
        ))}
      </div>

      <div style={{ height: 24 }} />

      <div style={{ fontSize: 12, color: T.slate500, fontWeight: 500 }}>Or:</div>

      <div style={{ height: 12 }} />

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <TertiaryButton onClick={() => setComeBackOpen(true)} disabled={submitting}>
          They want to come back
        </TertiaryButton>
        <TertiaryButton onClick={onRefused} disabled={submitting}>
          They didn&rsquo;t want to talk
        </TertiaryButton>
      </div>

      <div style={{ flex: 1, minHeight: 16 }} />

      {error ? (
        <div
          role="alert"
          style={{
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

      {toast ? (
        <div
          role="status"
          style={{
            position: "absolute",
            top: 16,
            left: 16,
            right: 16,
            padding: "12px 16px",
            background: T.navy800,
            color: T.white,
            borderRadius: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 14,
            boxShadow: "0 4px 14px rgba(10,22,40,0.25)",
          }}
        >
          <span>
            Logged for {toast.name} &mdash; {toast.outcome}
          </span>
        </div>
      ) : null}

      {comeBackOpen ? (
        <ComeBackModal
          onCancel={() => setComeBackOpen(false)}
          onPick={onComeBack}
          disabled={submitting}
        />
      ) : null}
    </div>
  );
}

function OutcomeButton({
  outcome,
  onClick,
  disabled,
}: {
  outcome: (typeof OUTCOMES)[number];
  onClick: () => void;
  disabled: boolean;
}) {
  const [pressed, setPressed] = useState(false);
  const Icon = outcome.Icon;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{
        height: 64,
        padding: 16,
        borderRadius: 12,
        borderTop: `1px solid ${outcome.color}33`,
        borderRight: `1px solid ${outcome.color}33`,
        borderBottom: `1px solid ${outcome.color}33`,
        borderLeft: `${pressed ? 6 : 4}px solid ${outcome.color}`,
        background: outcome.bg,
        color: T.navy900,
        cursor: disabled ? "wait" : "pointer",
        fontFamily: fontInter,
        fontWeight: 600,
        fontSize: 16,
        display: "flex",
        alignItems: "center",
        gap: 12,
        textAlign: "left",
        transform: pressed ? "scale(0.98)" : "scale(1)",
        transition: "transform 100ms, border-left-width 100ms",
        opacity: disabled ? 0.7 : 1,
      }}
    >
      <span style={{ color: outcome.color, display: "inline-flex" }}>
        <Icon size={20} />
      </span>
      <span>{outcome.label}</span>
    </button>
  );
}

function TertiaryButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        height: 48,
        padding: "0 16px",
        background: T.white,
        border: `1px solid ${T.slate200}`,
        color: T.navy900,
        borderRadius: 12,
        cursor: disabled ? "wait" : "pointer",
        fontFamily: fontInter,
        fontWeight: 500,
        fontSize: 15,
        textAlign: "center",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {children}
    </button>
  );
}

function ComeBackModal({
  onCancel,
  onPick,
  disabled,
}: {
  onCancel: () => void;
  onPick: (bucket: (typeof COME_BACK_BUCKETS)[number]["id"]) => void;
  disabled: boolean;
}) {
  return (
    <div
      role="dialog"
      aria-label="When should we come back?"
      onClick={onCancel}
      style={{
        position: "absolute",
        inset: 0,
        background: "rgba(10,22,40,0.42)",
        display: "flex",
        alignItems: "flex-end",
        zIndex: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          background: T.white,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          padding: "20px 16px 24px",
          boxShadow: "0 -8px 24px rgba(10,22,40,0.16)",
        }}
      >
        <h2
          style={{
            margin: 0,
            fontWeight: 700,
            fontSize: 20,
            letterSpacing: "-0.015em",
            color: T.navy900,
          }}
        >
          When should we come back?
        </h2>
        <div style={{ height: 20 }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {COME_BACK_BUCKETS.map((b) => (
            <button
              key={b.id}
              onClick={() => onPick(b.id)}
              disabled={disabled}
              style={{
                width: "100%",
                height: 56,
                padding: "0 16px",
                background: T.white,
                border: `1px solid ${T.slate200}`,
                borderRadius: 12,
                color: T.navy900,
                fontFamily: fontInter,
                fontWeight: 500,
                fontSize: 16,
                textAlign: "left",
                cursor: disabled ? "wait" : "pointer",
              }}
            >
              {b.label}
            </button>
          ))}
        </div>
        <div style={{ height: 16 }} />
        <button
          onClick={onCancel}
          style={{
            width: "100%",
            height: 48,
            background: "transparent",
            border: "none",
            color: T.slate600,
            fontFamily: fontInter,
            fontWeight: 500,
            fontSize: 15,
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
