import { redirect } from "next/navigation";
import { loadSession } from "@/lib/auth/session";
import { resolveUseVFlow } from "@/lib/volunteer/flag";

export const dynamic = "force-dynamic";

// Field-app entry point. Routes the volunteer to either:
//   - /v        → the rebuilt flow (default; clients can opt out via the
//                 admin settings toggle)
//   - /app/map  → the legacy knocker app (only when use_v_flow is false
//                 on the client OR a v_flow=off cookie is set)
//
// Cookie writes can't happen in a Server Component, so the ?v=on / ?v=off /
// ?v=clear override is handled by /api/v-flag, which sets the cookie and
// 303s back here.

export default async function AppIndex({
  searchParams,
}: {
  searchParams: { v?: string };
}) {
  const session = await loadSession();
  if (!session) redirect("/login");
  if (session.user.must_change_password) redirect("/set-password");

  const v = searchParams.v;
  if (v === "on" || v === "off" || v === "clear") {
    redirect(`/api/v-flag?v=${v}`);
  }

  const useV = await resolveUseVFlow(session.user);
  if (useV) redirect("/v");
  redirect("/app/map");
}
