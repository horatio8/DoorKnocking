"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { T, fontInter } from "@/lib/volunteer/tokens";
import { MapPreview } from "@/components/volunteer/map-preview";

export function WalkbookClient({
  walkbook,
}: {
  walkbook: {
    id: string;
    name: string;
    doors: number;
    durationMins: number | null;
    start: { line1: string; line2: string; lat: number | null; lng: number | null } | null;
  };
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const goBack = () => router.push("/v/time");

  const getDirections = () => {
    if (!walkbook.start) return;
    const lat = walkbook.start.lat;
    const lng = walkbook.start.lng;
    const isApple =
      typeof navigator !== "undefined" && /iPhone|iPad|iPod|Mac/i.test(navigator.userAgent);
    if (lat != null && lng != null) {
      const url = isApple
        ? `maps://?daddr=${lat},${lng}&dirflg=d`
        : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
      window.location.href = url;
      return;
    }
    const dest = encodeURIComponent(`${walkbook.start.line1}, ${walkbook.start.line2}`);
    const url = isApple
      ? `maps://?daddr=${dest}&dirflg=d`
      : `https://www.google.com/maps/dir/?api=1&destination=${dest}`;
    window.location.href = url;
  };

  const arrived = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/knocker/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walkbook_id: walkbook.id }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Couldn't start your session. Try again.");
      }
      router.push(`/v/walkbook/${walkbook.id}/briefing`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  };

  const durationLabel =
    walkbook.durationMins != null ? `~${walkbook.durationMins} min` : "duration tbd";

  return (
    <div
      style={{
        flex: 1,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        background: T.white,
        fontFamily: fontInter,
        position: "relative",
      }}
    >
      <div style={{ padding: "52px 16px 8px", display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={goBack}
          aria-label="Back"
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            border: `1px solid ${T.slate200}`,
            background: T.white,
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
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: T.slate500,
          }}
        >
          Your walkbook
        </div>
      </div>

      <div style={{ flex: 1, padding: "0 16px", minHeight: 280 }}>
        <MapPreview height="100%" />
      </div>

      <div style={{ padding: "20px 16px 24px" }}>
        <h1
          style={{
            margin: 0,
            fontWeight: 700,
            fontSize: 24,
            lineHeight: "30px",
            letterSpacing: "-0.01em",
            color: T.navy900,
          }}
        >
          {walkbook.name}
        </h1>
        <div
          style={{
            marginTop: 4,
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            alignItems: "center",
            fontSize: 13,
            color: T.slate600,
          }}
        >
          <span>
            <b style={{ color: T.navy900, fontWeight: 600 }}>{walkbook.doors}</b> doors
          </span>
          <span style={{ color: T.slate200 }}>·</span>
          <span>{durationLabel}</span>
        </div>

        {walkbook.start ? (
          <div
            style={{
              marginTop: 14,
              padding: 12,
              background: T.slate50,
              border: `1px solid ${T.slate100}`,
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                background: T.crimson50,
                border: `1px solid ${T.crimson100}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke={T.crimson600}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            </div>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: T.slate500,
                }}
              >
                Start here
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: T.navy900, marginTop: 2 }}>
                {walkbook.start.line1}
              </div>
              {walkbook.start.line2 ? (
                <div style={{ fontSize: 12, color: T.slate600 }}>{walkbook.start.line2}</div>
              ) : null}
            </div>
          </div>
        ) : null}

        <div style={{ height: 16 }} />

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

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Btn variant="secondary" onClick={getDirections}>
            Get directions
          </Btn>
          <Btn variant="primary" disabled={submitting} onClick={arrived}>
            {submitting ? "Starting…" : "I’m already there"}
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
        </div>
      </div>
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
      ? { bg: T.crimson600, fg: T.white, border: T.crimson600 }
      : { bg: T.white, fg: T.navy900, border: T.slate200 };
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
        border: `1px solid ${s.border}`,
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
