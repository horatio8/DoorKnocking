import Link from "next/link";
import { redirect } from "next/navigation";
import { loadSession } from "@/lib/auth/session";
import { loadCurrentRouteForUser, loadRoute } from "@/lib/queue/load-route";
import { T, fontInter } from "@/lib/volunteer/tokens";
import { WalkbookClient } from "./walkbook-client";

export const dynamic = "force-dynamic";

// Screen 4 — "Your route" landing.
// In the queue model this is the first screen that shows a real,
// session-specific walkbook generated from the top of the voter queue.

export default async function WalkbookLandingPage({
  searchParams,
}: {
  searchParams: { wb?: string };
}) {
  const session = await loadSession();
  if (!session) redirect("/login");

  const route = searchParams.wb
    ? await loadRoute(searchParams.wb)
    : await loadCurrentRouteForUser(session.user.id);

  if (!route) {
    return (
      <EmptyState>
        Pick a time on the previous screen and we&rsquo;ll build you a route from the queue.
      </EmptyState>
    );
  }

  const active = route.voters.filter((v) => !v.isBacklog);
  if (active.length === 0) {
    return (
      <EmptyState>
        No high-scoring voters within reach right now. Try a longer session, or come back at a
        different time of day when more residents tend to be home.
      </EmptyState>
    );
  }

  const start = active[0]!;
  const startingAddress = {
    line1: start.addressLine1,
    line2: [start.city, start.state].filter(Boolean).join(", "),
    lat: start.lat,
    lng: start.lng,
  };

  // Estimate displayed minutes — voter count × ~2.5 min walking budget.
  const estimatedMinutes = route.targetMinutes
    ? Math.min(route.targetMinutes, Math.round(active.length * 2.5 + 5))
    : Math.round(active.length * 2.5 + 5);

  return (
    <WalkbookClient
      walkbook={{
        id: route.walkbookId,
        name: "Your route for today",
        doors: active.length,
        durationMins: estimatedMinutes,
        start: startingAddress,
        drivingMinutesToClosest: route.drivingMinutesToClosest,
      }}
    />
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
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
      <h1 style={{ margin: 0, fontWeight: 700, fontSize: 26, letterSpacing: "-0.02em" }}>
        Nothing to knock yet
      </h1>
      <p style={{ marginTop: 12, color: T.slate600 }}>{children}</p>
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
        Pick a different time
      </Link>
    </div>
  );
}
