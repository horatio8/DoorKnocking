"use client";

// Screen 1 — Welcome (Variant C, "Navy banner")
// Picked variant per design_handoff_volunteer_flow/README.md.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { T, fontInter, fontSerif } from "@/lib/volunteer/tokens";
import { loadSession, patchSession } from "@/lib/volunteer/session";

export default function WelcomePage() {
  const router = useRouter();
  const [ctx, setCtx] = useState({
    firstName: "James",
    clientName: "Sprouse for SC House 115",
    electionDate: "May 14",
  });

  useEffect(() => {
    const s = loadSession();
    setCtx({
      firstName: s.firstName,
      clientName: s.candidateName,
      electionDate: s.electionDate,
    });
  }, []);

  const onReady = () => {
    patchSession({});
    router.push("/v/time");
  };

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        background: T.white,
        fontFamily: fontInter,
        color: T.navy900,
      }}
    >
      <div
        style={{
          background: T.navy800,
          color: T.navy100,
          padding: "64px 24px 28px",
        }}
      >
        <Overline color={T.navy400}>You&rsquo;re helping</Overline>
        <div
          style={{
            marginTop: 8,
            fontFamily: fontSerif,
            fontWeight: 600,
            fontSize: 24,
            lineHeight: "30px",
            letterSpacing: "-0.015em",
            color: T.white,
            textWrap: "balance" as const,
          }}
        >
          {ctx.clientName}
        </div>
        <div
          style={{
            marginTop: 12,
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "4px 10px",
            background: "rgba(220, 38, 38, 0.16)",
            border: `1px solid ${T.crimson500}`,
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 600,
            color: "#FCA5A5",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: 3, background: T.crimson500 }} />
          Election {ctx.electionDate}
        </div>
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          padding: "24px 24px",
        }}
      >
        <h1
          style={{
            margin: 0,
            fontFamily: fontInter,
            fontWeight: 700,
            fontSize: 26,
            lineHeight: "32px",
            letterSpacing: "-0.02em",
            color: T.navy900,
            textWrap: "balance" as const,
          }}
        >
          Welcome,&nbsp;
          <span
            style={{
              fontFamily: fontSerif,
              fontWeight: 600,
              fontSize: 26,
              letterSpacing: "-0.015em",
            }}
          >
            {ctx.firstName}
          </span>
        </h1>

        <p style={{ margin: "12px 0 0", fontSize: 16, lineHeight: "24px", color: T.navy800 }}>
          Today you&rsquo;ll knock on doors in your assigned area and ask voters about their
          priorities.
        </p>

        <p style={{ margin: "16px 0 0", fontSize: 15, lineHeight: "22px", color: T.slate600 }}>
          Most conversations take two minutes. Most people are nice. If someone&rsquo;s not, just
          thank them and walk away.
        </p>

        <div style={{ flex: 1 }} />

        <PrimaryCTA label="I&rsquo;m ready" onClick={onReady} />
      </div>
    </div>
  );
}

function Overline({ children, color = T.slate500 }: { children: React.ReactNode; color?: string }) {
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

function PrimaryCTA({ label, onClick }: { label: string; onClick: () => void }) {
  const [pressed, setPressed] = useState(false);
  return (
    <button
      onClick={onClick}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{
        width: "100%",
        height: 56,
        background: pressed ? T.crimson700 : T.crimson600,
        color: T.white,
        border: "none",
        borderRadius: 8,
        fontFamily: fontInter,
        fontWeight: 600,
        fontSize: 16,
        letterSpacing: "-0.005em",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        cursor: "pointer",
        transition:
          "background 100ms cubic-bezier(0.16, 1, 0.3, 1), transform 100ms cubic-bezier(0.16, 1, 0.3, 1)",
        transform: pressed ? "scale(0.985)" : "scale(1)",
      }}
    >
      <span dangerouslySetInnerHTML={{ __html: label }} />
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
        <path d="M5 12h14M13 5l7 7-7 7" />
      </svg>
    </button>
  );
}
