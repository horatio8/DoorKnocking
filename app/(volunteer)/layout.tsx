import type { ReactNode } from "react";

// Mobile-first frame for the volunteer flow. No auth wrapping — these screens
// are the rebuilt prototype against the new design handoff. The volunteer
// session lives in localStorage; see lib/volunteer/session.ts.

export default function VolunteerLayout({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "#0A1628",
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        fontFamily: "Inter, system-ui, sans-serif",
        color: "#0A1628",
      }}
    >
      <div
        style={{
          flex: 1,
          width: "100%",
          maxWidth: 440,
          margin: "0 auto",
          background: "#FFFFFF",
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {children}
      </div>
    </div>
  );
}
