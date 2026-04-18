import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import {
  buildAuthorizeUrl,
  generatePKCE,
  isOAuthEnabled,
  signState,
} from "@/lib/airtable/oauth";

const COOKIE_NAME = "airtable_oauth";
const COOKIE_TTL_S = 10 * 60;

export const dynamic = "force-dynamic";

// GET /api/airtable/oauth/start?clientId=<uuid>&returnTo=/admin/airtable?district=...
// Alternatively: &districtId=<uuid> resolves client via district.client_id.
export async function GET(req: Request) {
  const session = await loadSession();
  if (!session || (session.user.role !== "admin" && session.user.role !== "super_admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (!isOAuthEnabled()) {
    return NextResponse.json(
      {
        error:
          "Airtable OAuth not configured on this deployment. Set AIRTABLE_OAUTH_CLIENT_ID, AIRTABLE_OAUTH_CLIENT_SECRET, and AIRTABLE_OAUTH_REDIRECT_URI in Vercel.",
      },
      { status: 501 },
    );
  }

  const url = new URL(req.url);
  let clientId = url.searchParams.get("clientId");
  const districtId = url.searchParams.get("districtId");
  const returnTo = url.searchParams.get("returnTo") || "/admin/settings";

  if (!clientId && districtId) {
    const supabase = getSupabaseServiceRoleClient();
    const { data } = await supabase
      .from("districts")
      .select("client_id")
      .eq("id", districtId)
      .maybeSingle();
    if (data?.client_id) clientId = data.client_id as string;
  }
  if (!clientId) {
    return NextResponse.json({ error: "clientId or districtId required" }, { status: 400 });
  }

  const { verifier, challenge } = generatePKCE();
  const nonce = crypto.randomUUID();
  const state = signState({ clientId, nonce, ts: Date.now(), returnTo });
  const authorizeUrl = buildAuthorizeUrl(state, challenge);

  const res = NextResponse.redirect(authorizeUrl);
  res.cookies.set(COOKIE_NAME, JSON.stringify({ verifier, nonce }), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_TTL_S,
  });
  return res;
}
