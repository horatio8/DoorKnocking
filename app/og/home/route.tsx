import { ImageResponse } from "next/og";

// /og/home — 1200×630 OG image rendered at the edge via next/og.
// Mirrors the homepage hero in flat-color form (no remote fonts so the
// route stays edge-runtime-fast).

export const runtime = "edge";

const SIZE = { width: 1200, height: 630 } as const;

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#0B2545",
          color: "#F7F3EC",
          padding: "72px 80px",
          fontFamily: "Georgia, serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <svg width="36" height="36" viewBox="0 0 40 40" fill="none">
            <path
              d="M20 3 L35 8 V20 C35 29 28 35 20 37 C12 35 5 29 5 20 V8 Z"
              stroke="#F7F3EC"
              strokeWidth={1.5}
            />
            <path
              d="M20 11 L21.4 14.2 L24.8 14.5 L22.3 16.8 L23 20.1 L20 18.4 L17 20.1 L17.7 16.8 L15.2 14.5 L18.6 14.2 Z"
              fill="#F7F3EC"
            />
          </svg>
          <span style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.01em" }}>Knock</span>
          <span
            style={{
              fontSize: 11,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "rgba(247,243,236,0.55)",
              borderLeft: "1px solid rgba(247,243,236,0.2)",
              paddingLeft: 14,
              marginLeft: 4,
            }}
          >
            Campaign OS
          </span>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            flex: 1,
            marginTop: 40,
          }}
        >
          <div
            style={{
              fontSize: 14,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "#8B2635",
              fontWeight: 700,
              marginBottom: 24,
            }}
          >
            ★&nbsp;&nbsp;&nbsp;Door-knock software
          </div>
          <div
            style={{
              fontSize: 80,
              fontWeight: 600,
              lineHeight: 1.02,
              letterSpacing: "-0.025em",
              color: "#F7F3EC",
              maxWidth: 980,
            }}
          >
            For{" "}
            <span style={{ color: "#8B2635", fontStyle: "italic" }}>serious campaigns.</span>
          </div>
          <div
            style={{
              marginTop: 28,
              fontSize: 24,
              lineHeight: 1.4,
              color: "rgba(247,243,236,0.75)",
              maxWidth: 760,
              fontFamily: "Helvetica, Arial, sans-serif",
            }}
          >
            District-agnostic field operations for professional campaign teams.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 16,
            color: "rgba(247,243,236,0.55)",
            fontFamily: "Helvetica, Arial, sans-serif",
            letterSpacing: "0.02em",
          }}
        >
          <span>14-day free trial · no credit card</span>
          <span style={{ color: "#8B2635", fontWeight: 700 }}>★ 99.9% UPTIME</span>
        </div>
      </div>
    ),
    SIZE,
  );
}
