import { redirect } from "next/navigation";
import { loadSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

// Field-app entry point. The "Open field app" button on the marketing site
// points here, as does the post-login redirect for knockers. Send everyone
// into the rebuilt /v/* volunteer flow; /v/welcome handles the "already
// completed welcome" pass-through and bounces straight to /v/time when set.
//
// Admins and unauthenticated visitors get the same redirect treatment they
// would have hit before (login → admin) because /v's layout itself
// redirects unauthed callers to /login and admins drop through to the same
// flow until they pick a different surface.
export default async function AppIndex() {
  const session = await loadSession();
  if (!session) redirect("/login");
  if (session.user.must_change_password) redirect("/set-password");
  redirect("/v");
}
