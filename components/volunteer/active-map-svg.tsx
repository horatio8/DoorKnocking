"use client";

// Static "active map" SVG used on the active-map screen.
// Mirrors components/active-map.jsx (function ActiveMap) from the design handoff.

import { useMemo } from "react";

export function ActiveMapSvg({
  height = "100%",
  currentN = 8,
  total = 18,
}: {
  height?: number | string;
  currentN?: number;
  total?: number;
}) {
  const pts = useMemo(() => {
    const out: [number, number][] = [];
    for (let i = 0; i < total; i++) {
      const row = Math.floor(i / 5);
      const col = row % 2 === 0 ? i % 5 : 4 - (i % 5);
      out.push([60 + col * 60, 60 + row * 50]);
    }
    return out;
  }, [total]);

  const knocked = Math.max(0, currentN - 1);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height,
        background: "#E8EBE5",
        overflow: "hidden",
      }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 360 320"
        preserveAspectRatio="xMidYMid slice"
        style={{ display: "block" }}
      >
        <rect x="0" y="0" width="360" height="320" fill="#EEF1EA" />
        <path
          d="M0 200 L 90 180 L 130 220 L 200 215 L 240 245 L 360 235 L 360 320 L 0 320 Z"
          fill="#D8E2CC"
        />
        <circle cx="55" cy="35" r="22" fill="#D8E2CC" />
        <circle cx="320" cy="60" r="30" fill="#D8E2CC" />
        <g stroke="#FFFFFF" strokeWidth="14" strokeLinecap="round">
          <path d="M-10 90 Q 80 100 180 80 T 380 100" />
          <path d="M-10 200 Q 90 190 200 210 T 380 200" />
          <path d="M70 -10 Q 80 80 100 200 T 110 340" />
          <path d="M260 -10 Q 270 100 290 200 T 300 340" />
        </g>
        <path
          d={pts
            .slice(0, knocked + 1)
            .map((p, i) => `${i === 0 ? "M" : "L"} ${p[0]} ${p[1]}`)
            .join(" ")}
          fill="none"
          stroke="#059669"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.5"
        />
        <path
          d={pts
            .slice(knocked)
            .map((p, i) => `${i === 0 ? "M" : "L"} ${p[0]} ${p[1]}`)
            .join(" ")}
          fill="none"
          stroke="#1F3654"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="3 5"
          opacity="0.55"
        />
        {pts.map(([x, y], i) => {
          const n = i + 1;
          if (n < currentN) {
            return (
              <g key={i}>
                <circle cx={x} cy={y} r="9" fill="#059669" stroke="white" strokeWidth="2" />
                <path
                  d={`M ${x - 3} ${y} L ${x - 1} ${y + 2.5} L ${x + 3.5} ${y - 2.5}`}
                  fill="none"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </g>
            );
          }
          if (n === currentN) {
            return (
              <g key={i}>
                <circle cx={x} cy={y} r="14" fill="#B91C1C" opacity="0.18">
                  <animate
                    attributeName="r"
                    values="11;18;11"
                    dur="1.5s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    values="0.4;0.05;0.4"
                    dur="1.5s"
                    repeatCount="indefinite"
                  />
                </circle>
                <circle cx={x} cy={y} r="11" fill="#B91C1C" stroke="white" strokeWidth="2.5" />
                <text
                  x={x}
                  y={y + 3.5}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="700"
                  fill="white"
                  fontFamily="Inter, sans-serif"
                >
                  {n}
                </text>
              </g>
            );
          }
          return (
            <g key={i}>
              <circle
                cx={x}
                cy={y}
                r="9"
                fill="white"
                stroke="#1F3654"
                strokeWidth="1.5"
                opacity="0.85"
              />
              <text
                x={x}
                y={y + 3}
                textAnchor="middle"
                fontSize="9"
                fontWeight="600"
                fill="#1F3654"
                fontFamily="Inter, sans-serif"
              >
                {n}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
