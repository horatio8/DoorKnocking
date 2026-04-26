import { redirect } from "next/navigation";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { getActiveClient } from "@/lib/clients/active";
import type { ReactNode } from "react";

// Auth guard for the volunteer flow.
// Anyone unauthenticated is bounced to /login. The session is fetched once
// here and exposed via the rendered children (each page re-loads cheaply
// via React's request-scoped cache).

export default async function VolunteerLayout({ children }: { children: ReactNode }) {
  const session = await loadSession();
  if (!session) redirect("/login");
  if (session.user.must_change_password) redirect("/set-password");

  // Touch the active client so brand colors hydrate the same way as the
  // marketing surface.
  await getActiveClient();
  // Service-role pre-warm so the first per-request query is quick.
  getSupabaseServiceRoleClient();

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
