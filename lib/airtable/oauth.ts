// Airtable OAuth2 helpers. One app registration on Airtable; tenancy is
// threaded through the signed `state` param — whoever logs in on Airtable's
// side decides which bases their token sees, and we store the tokens against
// whichever `clientId` the state encodes.
//
// Node runtime only (uses node:crypto). Do not import from middleware/edge.

import crypto from "node:crypto";

const AIRTABLE_AUTHORIZE_URL = "https://airtable.com/oauth2/v1/authorize";
const AIRTABLE_TOKEN_URL = "https://airtable.com/oauth2/v1/token";
const REQUIRED_SCOPES = ["data.records:read", "data.records:write", "schema.bases:read"];
const STATE_TTL_MS = 10 * 60 * 1000;

export const AIRTABLE_OAUTH_REQUIRED_SCOPES = REQUIRED_SCOPES;

interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  appSecret: string;
}

export function oauthConfig(): OAuthConfig | null {
  const clientId = process.env.AIRTABLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.AIRTABLE_OAUTH_CLIENT_SECRET;
  const redirectUri = process.env.AIRTABLE_OAUTH_REDIRECT_URI;
  const appSecret = process.env.APP_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!clientId || !clientSecret || !redirectUri || !appSecret) return null;
  return { clientId, clientSecret, redirectUri, appSecret };
}

export function isOAuthEnabled(): boolean {
  return oauthConfig() !== null;
}

function b64url(buf: Buffer | Uint8Array): string {
  return Buffer.from(buf).toString("base64url");
}

export function generatePKCE(): { verifier: string; challenge: string } {
  const verifier = b64url(crypto.randomBytes(48));
  const challenge = b64url(crypto.createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

interface StatePayload {
  clientId: string;
  nonce: string;
  ts: number;
  returnTo: string;
}

export function signState(payload: StatePayload): string {
  const cfg = oauthConfig();
  if (!cfg) throw new Error("OAuth not configured");
  const body = b64url(Buffer.from(JSON.stringify(payload)));
  const sig = b64url(crypto.createHmac("sha256", cfg.appSecret).update(body).digest());
  return `${body}.${sig}`;
}

export function verifyState(state: string): StatePayload | null {
  const cfg = oauthConfig();
  if (!cfg) return null;
  const idx = state.indexOf(".");
  if (idx < 0) return null;
  const body = state.slice(0, idx);
  const sig = state.slice(idx + 1);
  const expected = b64url(crypto.createHmac("sha256", cfg.appSecret).update(body).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const decoded = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as StatePayload;
    if (typeof decoded !== "object" || decoded === null) return null;
    if (typeof decoded.ts !== "number") return null;
    if (Date.now() - decoded.ts > STATE_TTL_MS) return null;
    if (typeof decoded.clientId !== "string" || !decoded.clientId) return null;
    return {
      clientId: decoded.clientId,
      nonce: String(decoded.nonce ?? ""),
      ts: decoded.ts,
      returnTo: String(decoded.returnTo ?? ""),
    };
  } catch {
    return null;
  }
}

export function buildAuthorizeUrl(state: string, codeChallenge: string): string {
  const cfg = oauthConfig();
  if (!cfg) throw new Error("OAuth not configured");
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    response_type: "code",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state,
    scope: REQUIRED_SCOPES.join(" "),
  });
  return `${AIRTABLE_AUTHORIZE_URL}?${params.toString()}`;
}

export interface AirtableTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  refresh_expires_in?: number;
  scope: string;
  token_type: "Bearer";
}

async function postToken(body: URLSearchParams): Promise<AirtableTokenResponse> {
  const cfg = oauthConfig();
  if (!cfg) throw new Error("OAuth not configured");
  const basic = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString("base64");
  const res = await fetch(AIRTABLE_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Airtable token ${res.status}: ${text}`);
  }
  return (await res.json()) as AirtableTokenResponse;
}

export function exchangeCode(code: string, verifier: string): Promise<AirtableTokenResponse> {
  const cfg = oauthConfig();
  if (!cfg) throw new Error("OAuth not configured");
  return postToken(
    new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: cfg.redirectUri,
      client_id: cfg.clientId,
      code_verifier: verifier,
    }),
  );
}

export function refreshAccessToken(refreshToken: string): Promise<AirtableTokenResponse> {
  const cfg = oauthConfig();
  if (!cfg) throw new Error("OAuth not configured");
  return postToken(
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: cfg.clientId,
    }),
  );
}

export function missingScopes(granted: string): string[] {
  const set = new Set(granted.split(/\s+/).filter(Boolean));
  return REQUIRED_SCOPES.filter((s) => !set.has(s));
}
