"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { T, fontInter, fontSerif } from "@/lib/volunteer/tokens";
import type { VolunteerHousehold } from "@/lib/volunteer/load-household";

// Screen 7 — Household detail.
// 64px Crimson "Nobody answered" is the most prominent action: tap pin →
// tap button = 2 taps, satisfying the no-answer rule from § 1.2.

export function HouseholdClient({
  household,
  walkbookId,
  knockSessionId,
}: {
  household: VolunteerHousehold;
  walkbookId: string | null;
  knockSessionId: string | null;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const log = async (status: "no_answer" | "wrong_address" | "moved") => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    const id = crypto.randomUUID();
    try {
      const res = await fetch("/api/knocker/knock-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          client_event_id: id,
          household_id: household.id,
          voter_id: null,
          walkbook_id: walkbookId,
          status: status === "moved" ? "wrong_address" : status,
          knocked_at: new Date().toISOString(),
          notes: status === "moved" ? "voter has moved away" : null,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Couldn't log that knock. Try again.");
      }
      router.push("/v/map");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  };

  void knockSessionId; // reserved for cross-walkbook session tracking.

  const subAddress = [household.city, household.state].filter(Boolean).join(", ");

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
      }}
    >
      <button
        onClick={() => router.push("/v/map")}
        aria-label="Back to map"
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
        Back
      </button>

      <div style={{ height: 16 }} />

      <h1
        style={{
          margin: 0,
          fontWeight: 700,
          fontSize: 28,
          lineHeight: "32px",
          letterSpacing: "-0.02em",
        }}
      >
        {household.addressLine1}
      </h1>
      {subAddress ? (
        <div style={{ marginTop: 4, fontSize: 14, color: T.slate600 }}>{subAddress}</div>
      ) : null}

      <div style={{ height: 16 }} />

      {household.voters.length > 0 ? (
        <Overline>
          {household.voters.length} {household.voters.length === 1 ? "person lives" : "people live"} here
        </Overline>
      ) : (
        <Overline>No registered voters on file</Overline>
      )}

      <div style={{ height: 12 }} />

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {household.voters.map((v) => (
          <VoterCard
            key={v.id}
            voter={v}
            onClick={() => router.push(`/v/household/${household.id}/voter/${v.id}`)}
          />
        ))}
      </div>

      <div style={{ flex: 1, minHeight: 16 }} />

      {error ? (
        <div
          role="alert"
          style={{
            marginBottom: 12,
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

      <button
        onClick={() => log("no_answer")}
        disabled={submitting}
        style={{
          width: "100%",
          height: 64,
          background: T.crimson600,
          color: T.white,
          border: "none",
          borderRadius: 12,
          fontFamily: fontInter,
          fontWeight: 600,
          fontSize: 16,
          cursor: submitting ? "wait" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: submitting ? 0.7 : 1,
        }}
      >
        Nobody answered
      </button>

      <div style={{ height: 12 }} />

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <TertiaryText onClick={() => log("wrong_address")}>Wrong address</TertiaryText>
        <TertiaryText onClick={() => log("moved")}>Voter has moved away</TertiaryText>
      </div>
    </div>
  );
}

function VoterCard({
  voter,
  onClick,
}: {
  voter: import("@/lib/volunteer/load-household").VolunteerVoter;
  onClick: () => void;
}) {
  const [pressed, setPressed] = useState(false);
  return (
    <button
      onClick={onClick}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{
        textAlign: "left",
        padding: 16,
        background: pressed ? T.slate50 : T.white,
        border: `1px solid ${pressed ? T.crimson600 : T.slate200}`,
        borderRadius: 12,
        cursor: "pointer",
        fontFamily: fontInter,
      }}
    >
      <div
        style={{
          fontFamily: fontSerif,
          fontWeight: 600,
          fontSize: 18,
          color: T.navy900,
          letterSpacing: "-0.005em",
        }}
      >
        {voter.displayName}
      </div>
      {voter.party ? (
        <div style={{ fontSize: 14, color: T.slate600, marginTop: 2 }}>{voter.party}</div>
      ) : null}
      {voter.priorNote ? (
        <div
          style={{
            fontStyle: "italic",
            fontSize: 13,
            color: T.slate500,
            marginTop: 8,
          }}
        >
          {voter.priorNote}
        </div>
      ) : null}
    </button>
  );
}

function Overline({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: fontInter,
        fontWeight: 600,
        fontSize: 11,
        lineHeight: "16px",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: T.slate500,
      }}
    >
      {children}
    </div>
  );
}

function TertiaryText({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: "transparent",
        border: "none",
        color: T.slate600,
        fontFamily: fontInter,
        fontWeight: 500,
        fontSize: 14,
        padding: "8px 0",
        cursor: "pointer",
        textAlign: "center",
      }}
    >
      {children}
    </button>
  );
}
