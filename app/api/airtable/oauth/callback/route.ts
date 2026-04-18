import { NextResponse } from "next/server";
import { exchangeCode, missingScopes, verifyState } from "@/lib/airtable/oauth";
import { saveAirtableOAuthTokens } from "@/lib/airtable/credentials";

const COOKIE_NAME = "airtable_oauth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);

  const providerError = url.searchParams.get("error");
  if (providerError) {
    return fail(req, `Airtable returned error: ${providerError}`);
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return fail(req, "Missing code or state from Airtable callback");

  const decoded = verifyState(state);
  if (!decoded) return fail(req, "OAuth state is invalid or has expired. Please reconnect.");

  const cookieHeader = req.headers.get("cookie") ?? "";
  const raw = cookieHeader
    .split(/;\s*/)
    .find((c) => c.startsWith(`${COOKIE_NAME}=`))
    ?.slice(COOKIE_NAME.length + 1);
  if (!raw) return fail(req, "PKCE cookie missing — the flow must start and finish in the same browser.");

  let cookie: { verifier: string; nonce: string };
  try {
    cookie = JSON.parse(decodeURIComponent(raw));
  } catch {
    return fail(req, "PKCE cookie malformed — please reconnect.");
  }
  if (cookie.nonce !== decoded.nonce) {
    return fail(req, "State/cookie mismatch — possible CSRF. Please reconnect.");
  }

  let tokens;
  try {
    tokens = await exchangeCode(code, cookie.verifier);
  } catch (err) {
    return fail(req, `Token exchange failed: ${(err as Error).message}`);
  }

  const missing = missingScopes(tokens.scope);
  if (missing.length > 0) {
    return fail(
      req,
      `Airtable consent is missing required scopes (${missing.join(", ")}). Please reconnect and accept every scope.`,
    );
  }

  try {
    await saveAirtableOAuthTokens({
      clientId: decoded.clientId,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      scopes: tokens.scope.split(/\s+/).filter(Boolean),
    });
  } catch (err) {
    return fail(req, `Saving tokens failed: ${(err as Error).message}`);
  }

  const safeReturnTo = decoded.returnTo && decoded.returnTo.startsWith("/") ? decoded.returnTo : "/admin/settings";
  const redirectTarget = new URL(safeReturnTo, url.origin);
  redirectTarget.searchParams.set("airtable_connected", "1");
  const res = NextResponse.redirect(redirectTarget);
  res.cookies.delete(COOKIE_NAME);
  return res;
}

function fail(req: Request, message: string) {
  const origin = new URL(req.url).origin;
  const target = new URL("/admin/settings", origin);
  target.searchParams.set("airtable_error", message);
  const res = NextResponse.redirect(target);
  res.cookies.delete(COOKIE_NAME);
  return res;
}
