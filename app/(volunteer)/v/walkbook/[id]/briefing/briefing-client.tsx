"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { T, fontInter, fontSerif } from "@/lib/volunteer/tokens";

export function BriefingClient({
  firstName,
  campaignName,
  walkbookId,
}: {
  firstName: string;
  campaignName: string;
  walkbookId: string;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);

  const askForGps = (): Promise<GeolocationPosition | null> =>
    new Promise((resolve) => {
      if (typeof navigator === "undefined" || !navigator.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve(pos),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 6000 },
      );
    });

  const onStart = async () => {
    if (submitting) return;
    setSubmitting(true);
    setWarning(null);
    const pos = await askForGps();
    if (!pos) {
      setWarning(
        "We couldn't read your location. The map will still work but the next-door arrow won't appear.",
      );
    } else {
      // Best-effort first ping. We swallow errors here because the map screen
      // re-pings on mount and tolerates the table being missing.
      fetch("/api/knocker/gps-ping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy_m: pos.coords.accuracy,
        }),
      }).catch(() => null);
    }
    router.push(`/v/map?walkbook=${walkbookId}`);
  };

  return (
    <div
      style={{
        flex: 1,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        padding: "52px 16px 24px",
        background: T.white,
        fontFamily: fontInter,
      }}
    >
      <BackBar onBack={() => router.push("/v/walkbook")} />
      <div style={{ height: 8 }} />

      <div style={{ padding: "0 8px" }}>
        <Overline color={T.crimson600}>Your opening line</Overline>
      </div>

      <div style={{ height: 8 }} />

      <div
        style={{
          margin: "0 8px",
          padding: "20px 18px",
          background: T.navy50,
          border: `1px solid ${T.navy100}`,
          borderRadius: 12,
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 8,
            left: 12,
            fontFamily: fontSerif,
            fontSize: 36,
            lineHeight: 1,
            color: T.navy300,
          }}
        >
          &ldquo;
        </div>
        <div
          style={{
            fontFamily: fontSerif,
            fontWeight: 500,
            fontSize: 20,
            lineHeight: "28px",
            letterSpacing: "-0.01em",
            color: T.navy900,
            textWrap: "balance" as const,
            paddingLeft: 16,
          }}
        >
          Hi, I&rsquo;m {firstName}. I&rsquo;m with the {campaignName} campaign. Do you have a minute?
        </div>
      </div>

      <div style={{ height: 16 }} />

      <div style={{ padding: "0 8px" }}>
        <Row overline={"If they ask “what’s this about?”"}>
          We&rsquo;re asking voters about education and the issues that matter most.
        </Row>
        <Row overline="If they say no">
          &ldquo;No problem, thanks for your time.&rdquo; Walk away.
        </Row>
        <Row overline="Remember">Step back 3 feet. Be patient. Smile.</Row>
      </div>

      <div style={{ flex: 1, minHeight: 16 }} />

      {warning ? (
        <div
          role="alert"
          style={{
            marginBottom: 8,
            padding: "8px 12px",
            borderRadius: 8,
            background: T.amber100,
            border: `1px solid #FCD34D`,
            color: "#78350F",
            fontSize: 13,
          }}
        >
          {warning}
        </div>
      ) : null}

      <button
        onClick={onStart}
        disabled={submitting}
        style={{
          width: "100%",
          height: 52,
          background: T.crimson600,
          color: T.white,
          border: "none",
          borderRadius: 8,
          fontFamily: fontInter,
          fontWeight: 600,
          fontSize: 16,
          letterSpacing: "-0.005em",
          cursor: submitting ? "wait" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          opacity: submitting ? 0.7 : 1,
        }}
      >
        {submitting ? "Starting…" : "Got it — let’s go"}
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
  );
}

function BackBar({ onBack }: { onBack: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 8px" }}>
      <button
        onClick={onBack}
        style={{
          background: "transparent",
          border: "none",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          color: T.navy900,
          fontFamily: fontInter,
          fontWeight: 500,
          fontSize: 14,
          padding: 4,
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
        Back
      </button>
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

function Row({ overline, children }: { overline: string; children: React.ReactNode }) {
  return (
    <div style={{ paddingTop: 14, paddingBottom: 14, borderTop: `1px solid ${T.slate100}` }}>
      <Overline>{overline}</Overline>
      <div style={{ marginTop: 4, fontSize: 15, lineHeight: "22px", color: T.navy900 }}>
        {children}
      </div>
    </div>
  );
}
