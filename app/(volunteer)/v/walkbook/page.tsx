import Link from "next/link";
import { redirect } from "next/navigation";
import { loadSession } from "@/lib/auth/session";
import { loadVolunteerWalkbook } from "@/lib/volunteer/load-walkbook";
import { T, fontInter } from "@/lib/volunteer/tokens";
import { WalkbookClient } from "./walkbook-client";

export const dynamic = "force-dynamic";

// Screen 4 — Walkbook landing (Variant B, "Map dominant")
// Loads the volunteer's assigned walkbook (or the next open one in their
// district) so the screen reflects real-world routing, not stub data.

export default async function WalkbookLandingPage() {
  const session = await loadSession();
  if (!session) redirect("/login");

  const walkbook = await loadVolunteerWalkbook({
    userId: session.user.id,
    districtId: session.district?.id ?? session.user.default_district_id ?? null,
  });

  if (!walkbook) {
    return (
      <div
        style={{
          flex: 1,
          padding: "64px 24px 24px",
          background: T.white,
          fontFamily: fontInter,
          color: T.navy900,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <h1
          style={{
            margin: 0,
            fontWeight: 700,
            fontSize: 26,
            letterSpacing: "-0.02em",
          }}
        >
          No walkbook yet
        </h1>
        <p style={{ marginTop: 12, color: T.slate600 }}>
          Your campaign admin hasn&rsquo;t assigned you a route yet. Once they do, it&rsquo;ll show
          up here.
        </p>
        <div style={{ flex: 1 }} />
        <Link
          href="/v/time"
          style={{
            display: "block",
            textAlign: "center",
            padding: "14px 0",
            border: `1px solid ${T.slate200}`,
            borderRadius: 8,
            color: T.navy900,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Back
        </Link>
      </div>
    );
  }

  return <WalkbookClient walkbook={walkbook} />;
}
