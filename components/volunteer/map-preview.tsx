"use client";

// Static "map preview" SVG used on the walkbook landing screen.
// Not a real Mapbox embed; production replaces this with a Mapbox view scoped
// to the walkbook bbox. The visual mirrors the design comp exactly.

import { T } from "@/lib/volunteer/tokens";

export function MapPreview({ height = 220 }: { height?: number | string }) {
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height,
        background: "#E8EBE5",
        borderRadius: 12,
        overflow: "hidden",
        border: `1px solid ${T.slate200}`,
      }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 360 220"
        preserveAspectRatio="xMidYMid slice"
        style={{ display: "block" }}
      >
        <rect x="0" y="0" width="360" height="220" fill="#EEF1EA" />
        <path
          d="M0 130 L 90 110 L 130 150 L 200 145 L 240 175 L 360 165 L 360 220 L 0 220 Z"
          fill="#D8E2CC"
        />
        <circle cx="55" cy="55" r="22" fill="#D8E2CC" />
        <circle cx="290" cy="40" r="30" fill="#D8E2CC" />
        <g stroke="#FFFFFF" strokeWidth="14" strokeLinecap="round">
          <path d="M-10 60 Q 80 70 180 50 T 380 70" />
          <path d="M-10 130 Q 90 120 200 140 T 380 130" />
          <path d="M70 -10 Q 80 80 100 130 T 110 240" />
          <path d="M210 -10 Q 220 80 240 130 T 250 240" />
        </g>
        <g stroke="#E2E8F0" strokeWidth="1">
          <path d="M-10 60 Q 80 70 180 50 T 380 70" fill="none" />
          <path d="M-10 130 Q 90 120 200 140 T 380 130" fill="none" />
          <path d="M70 -10 Q 80 80 100 130 T 110 240" fill="none" />
          <path d="M210 -10 Q 220 80 240 130 T 250 240" fill="none" />
        </g>
        <path
          d="M58 50 L 215 45 L 245 145 L 95 155 Z"
          fill="rgba(31, 54, 84, 0.06)"
          stroke={T.navy700}
          strokeWidth="1.5"
          strokeDasharray="4 4"
        />
        {[
          [80, 80],
          [120, 75],
          [150, 95],
          [180, 70],
          [195, 110],
          [160, 130],
          [125, 140],
          [200, 135],
          [225, 90],
        ].map(([x, y], i) => (
          <circle
            key={i}
            cx={x}
            cy={y}
            r="4"
            fill="#3B82F6"
            opacity="0.45"
            stroke="white"
            strokeWidth="1.5"
          />
        ))}
        <g>
          <circle cx="108" cy="92" r="14" fill={T.crimson600} opacity="0.18">
            <animate attributeName="r" values="10;16;10" dur="1.5s" repeatCount="indefinite" />
            <animate
              attributeName="opacity"
              values="0.4;0.05;0.4"
              dur="1.5s"
              repeatCount="indefinite"
            />
          </circle>
          <circle cx="108" cy="92" r="7" fill={T.crimson600} stroke="white" strokeWidth="2" />
        </g>
      </svg>
      <div
        style={{
          position: "absolute",
          left: 12,
          bottom: 12,
          background: T.white,
          color: T.navy900,
          border: `1px solid ${T.slate200}`,
          borderRadius: 999,
          padding: "4px 10px",
          fontSize: 12,
          fontWeight: 600,
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          boxShadow: "0 1px 2px rgba(15,23,42,0.06)",
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: 3, background: T.crimson600 }} />
        Start here
      </div>
    </div>
  );
}
