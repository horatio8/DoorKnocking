import { redirect } from "next/navigation";
import { loadSession } from "@/lib/auth/session";
import { resolveUseVFlow } from "@/lib/volunteer/flag";

export const dynamic = "force-dynamic";

// Field-app entry point. Routes the volunteer to either:
//   - /v        → the rebuilt flow (when use_v_flow=true OR v_flow=on cookie)
//   - /app/map  → the legacy knocker app (default)
//
// Cookie writes can't happen in a Server Component, so the ?v=on / ?v=off /
// ?v=clear override is handled by the /api/v-flag route handler. Hitting
// /app?v=on bounces through /api/v-flag (which sets the cookie) → back to
// /app, which now resolves to /v on the next request.

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

  const useV = await resolveUseVFlow(session.user.id);
  if (useV) redirect("/v");
  redirect("/app/map");
}
