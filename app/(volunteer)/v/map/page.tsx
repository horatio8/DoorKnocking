import Link from "next/link";
import { redirect } from "next/navigation";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { loadMapBundle } from "@/lib/volunteer/load-map";
import { loadVolunteerWalkbook } from "@/lib/volunteer/load-walkbook";
import { publicEnv } from "@/lib/env";
import { T, fontInter } from "@/lib/volunteer/tokens";
import { MapClient } from "./map-client";

export const dynamic = "force-dynamic";

// Screen 6 — Active map.

export default async function MapPage({
  searchParams,
}: {
  searchParams: { walkbook?: string };
}) {
  const session = await loadSession();
  if (!session) redirect("/login");

  let walkbookId = searchParams.walkbook ?? null;
  if (!walkbookId) {
    const wb = await loadVolunteerWalkbook({
      userId: session.user.id,
      districtId: session.district?.id ?? session.user.default_district_id ?? null,
    });
    walkbookId = wb?.id ?? null;
  }

  if (!walkbookId) {
    return <EmptyState>Your campaign admin hasn&rsquo;t assigned you a walkbook yet.</EmptyState>;
  }

  const supabase = getSupabaseServiceRoleClient();
  const { data: profile } = await supabase
    .from("users")
    .select("next_session_minutes")
    .eq("id", session.user.id)
    .maybeSingle();
  const plannedMinutes =
    (profile as { next_session_minutes: number | null } | null)?.next_session_minutes ?? null;

  const bundle = await loadMapBundle({
    userId: session.user.id,
    walkbookId,
    plannedMinutes,
  });

  if (!bundle) {
    return <EmptyState>That walkbook isn&rsquo;t available right now.</EmptyState>;
  }

  return <MapClient mapboxToken={publicEnv.mapboxToken} bundle={bundle} />;
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
      <h1 style={{ margin: 0, fontWeight: 700, fontSize: 26 }}>Nothing to knock yet</h1>
      <p style={{ marginTop: 12, color: T.slate600 }}>{children}</p>
      <div style={{ flex: 1 }} />
      <Link
        href="/v/walkbook"
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
        Back to walkbook
      </Link>
    </div>
  );
}
