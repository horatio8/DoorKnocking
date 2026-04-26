import { NextResponse } from "next/server";
import { V_FLOW_COOKIE } from "@/lib/volunteer/flag";

// GET /api/v-flag?v=on|off|clear
//
// Sets / clears the `v_flow` cookie used by /app to decide between the
// legacy /app/map and the rebuilt /v flow. Cookie writes can't happen in
// a Server Component, so the /app page redirects here whenever it sees a
// ?v= param. Once the cookie is in place we 302 back to /app, which
// resolves to the right surface on the next request.

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const v = url.searchParams.get("v");
  const back = new URL("/app", url);

  const res = NextResponse.redirect(back, 303);

  if (v === "on" || v === "off") {
    res.cookies.set(V_FLOW_COOKIE, v, {
      maxAge: 60 * 60 * 24 * 30,
      sameSite: "lax",
      path: "/",
      httpOnly: false,
    });
  } else if (v === "clear") {
    res.cookies.delete(V_FLOW_COOKIE);
  }

  return res;
}
