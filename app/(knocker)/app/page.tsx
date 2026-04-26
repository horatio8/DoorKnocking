import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { loadSession } from "@/lib/auth/session";
import { resolveUseVFlow, V_FLOW_COOKIE } from "@/lib/volunteer/flag";

export const dynamic = "force-dynamic";

// Field-app entry point. Routes the volunteer to either:
//   - /v        → the rebuilt flow (when use_v_flow=true OR ?v=on cookie set)
//   - /app/map  → the legacy knocker app (default)
//
// Supports a one-shot ?v=on / ?v=off / ?v=clear query param so testers can
// flip themselves between the two flows without an admin write — useful
// during the cutover. The cookie sticks for 30 days.

export default async function AppIndex({
  searchParams,
}: {
  searchParams: { v?: string };
}) {
  const session = await loadSession();
  if (!session) redirect("/login");
  if (session.user.must_change_password) redirect("/set-password");

  // Apply the ad-hoc override before resolving the flag so a tester can
  // flip in one tap. We set the cookie here and then re-redirect to /app
  // without the param so refreshes don't keep stamping it.
  const v = searchParams.v;
  if (v === "on" || v === "off") {
    cookies().set(V_FLOW_COOKIE, v, {
      maxAge: 60 * 60 * 24 * 30,
      sameSite: "lax",
      path: "/",
    });
    redirect("/app");
  }
  if (v === "clear") {
    cookies().delete(V_FLOW_COOKIE);
    redirect("/app");
  }

  const useV = await resolveUseVFlow(session.user.id);
  if (useV) redirect("/v");
  redirect("/app/map");
}
