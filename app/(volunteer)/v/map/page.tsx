"use client";

// Screen 6 — Active map (Variant A, "Stacked sheet")

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { T, fontInter, fontSerif } from "@/lib/volunteer/tokens";
import { ActiveMapSvg } from "@/components/volunteer/active-map-svg";
import { loadSession } from "@/lib/volunteer/session";

const ROUTE = {
  walkbookName: "Riverland Woods",
  total: 18,
  current: {
    n: 8,
    line1: "1042 River Haven Cir",
    line2: "Charleston, SC",
    name: "Patricia Mendez",
    notes: "2-story, blue door, dog out back",
  },
};

export default function ActiveMapPage() {
  const router = useRouter();
  const [knocked, setKnocked] = useState(7);
  const total = ROUTE.total;
  const currentN = knocked + 1;
  const isFinished = knocked >= total;

  useEffect(() => {
    const s = loadSession();
    setKnocked(Math.min(s.results.length, total - 1));
  }, [total]);

  const onKnock = () => router.push("/v/door");
  const onSkip = () => {
    setKnocked((k) => Math.min(k + 1, total));
  };

  if (isFinished) {
    router.push("/v/complete");
    return null;
  }

  return (
    <div
      style={{
        flex: 1,
        boxSizing: "border-box",
        position: "relative",
        background: T.white,
        fontFamily: fontInter,
      }}
    >
      <div style={{ position: "absolute", inset: 0 }}>
        <ActiveMapSvg height="100%" currentN={currentN} total={total} />
      </div>

      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          padding: "52px 12px 0",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <button
          onClick={() => router.push("/v/walkbook/briefing")}
          aria-label="Back"
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            border: "none",
            background: "rgba(255,255,255,0.95)",
            boxShadow: "0 1px 3px rgba(15,23,42,0.12)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke={T.navy900}
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <div
          style={{
            flex: 1,
            padding: "8px 12px",
            background: "rgba(255,255,255,0.95)",
            border: `1px solid ${T.slate200}`,
            borderRadius: 8,
            boxShadow: "0 1px 3px rgba(15,23,42,0.08)",
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
            Walkbook
          </div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: T.navy900,
              letterSpacing: "-0.005em",
            }}
          >
            {ROUTE.walkbookName}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <MapCtrl ariaLabel="Recenter">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
            </svg>
          </MapCtrl>
          <MapCtrl ariaLabel="Zoom">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2v20M2 12h20" />
            </svg>
          </MapCtrl>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          background: T.white,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          boxShadow: "0 -8px 32px rgba(15,23,42,0.16)",
          padding: "12px 16px 24px",
        }}
      >
        <div
          style={{
            width: 40,
            height: 4,
            borderRadius: 2,
            background: T.slate200,
            margin: "0 auto 10px",
          }}
        />

        <ProgressBar knocked={knocked} total={total} />

        <div style={{ height: 14 }} />

        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              background: T.crimson50,
              border: `1px solid ${T.crimson100}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              fontFamily: fontInter,
              fontWeight: 700,
              fontSize: 14,
              color: T.crimson600,
            }}
          >
            {currentN}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: T.slate500,
              }}
            >
              Next door
            </div>
            <div
              style={{
                marginTop: 2,
                fontSize: 17,
                fontWeight: 600,
                color: T.navy900,
                letterSpacing: "-0.005em",
              }}
            >
              {ROUTE.current.line1}
            </div>
            <div style={{ fontSize: 13, color: T.slate600, marginTop: 1 }}>
              <span style={{ fontFamily: fontSerif, fontWeight: 500 }}>{ROUTE.current.name}</span>
              <span style={{ color: T.slate200, margin: "0 6px" }}>·</span>
              {ROUTE.current.notes}
            </div>
          </div>
        </div>

        <div style={{ height: 14 }} />

        <button
          onClick={onKnock}
          style={{
            width: "100%",
            height: 56,
            background: T.crimson600,
            color: T.white,
            border: "none",
            borderRadius: 12,
            fontFamily: fontInter,
            fontWeight: 600,
            fontSize: 17,
            letterSpacing: "-0.005em",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            boxShadow: "0 4px 14px rgba(185,28,28,0.25)",
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
            <path d="M10 17l5-5-5-5" />
            <path d="M15 12H3" />
          </svg>
          I knocked
        </button>

        <div style={{ marginTop: 10, textAlign: "center", fontSize: 13, color: T.slate500 }}>
          <button
            onClick={onSkip}
            style={{
              background: "none",
              border: "none",
              color: T.slate600,
              fontSize: 13,
              cursor: "pointer",
              fontFamily: fontInter,
              textDecoration: "underline",
              textUnderlineOffset: 3,
            }}
          >
            Skip this door
          </button>
        </div>
      </div>
    </div>
  );
}

function MapCtrl({
  children,
  ariaLabel,
  onClick,
}: {
  children: React.ReactNode;
  ariaLabel: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      style={{
        width: 40,
        height: 40,
        borderRadius: 8,
        background: T.white,
        border: `1px solid ${T.slate200}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        boxShadow: "0 1px 2px rgba(15,23,42,0.06)",
        color: T.navy700,
      }}
    >
      {children}
    </button>
  );
}

function ProgressBar({ knocked, total }: { knocked: number; total: number }) {
  const pct = Math.round((knocked / total) * 100);
  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          fontSize: 12,
          color: T.slate600,
        }}
      >
        <span>
          <b style={{ color: T.navy900, fontWeight: 600, fontSize: 13 }}>{knocked}</b> of {total}{" "}
          doors
        </span>
        <span>{pct}%</span>
      </div>
      <div
        style={{
          marginTop: 6,
          height: 6,
          background: T.slate100,
          borderRadius: 3,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: T.crimson600,
            borderRadius: 3,
          }}
        />
      </div>
    </div>
  );
}
