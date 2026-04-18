// Resolve an Airtable PAT for a given client. Looks at client_credentials
// first (stored per-client), falls back to the AIRTABLE_API_KEY env var so
// the default Teller client keeps working without a DB write.
//
// Server-only. Never export the resolved token to the client — call this
// inside API handlers only.

import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { refreshAccessToken } from "@/lib/airtable/oauth";

export interface ResolvedAirtableCredentials {
  token: string;
  source: "client" | "env";
  workspaceId: string | null;
}

interface CredentialsRow {
  airtable_token: string | null;
  airtable_workspace_id: string | null;
  airtable_access_token: string | null;
  airtable_refresh_token: string | null;
  airtable_token_expires_at: string | null;
}

// In-memory single-flight guard so a burst of Airtable calls from the same
// request batch only refreshes the token once. The map is per-process (so
// serverless function-instance scoped) but that's fine — refresh tokens
// rotate on every exchange, and we write the new one back to the DB before
// the promise resolves, so concurrent instances just see the fresh value on
// the next read.
const refreshInflight = new Map<string, Promise<string>>();

async function refreshOAuthTokens(clientId: string, refreshToken: string): Promise<string> {
  const existing = refreshInflight.get(clientId);
  if (existing) return existing;
  const promise = (async () => {
    try {
      const fresh = await refreshAccessToken(refreshToken);
      await saveAirtableOAuthTokens({
        clientId,
        accessToken: fresh.access_token,
        refreshToken: fresh.refresh_token,
        expiresAt: new Date(Date.now() + fresh.expires_in * 1000),
        scopes: fresh.scope.split(/\s+/).filter(Boolean),
      });
      return fresh.access_token;
    } finally {
      refreshInflight.delete(clientId);
    }
  })();
  refreshInflight.set(clientId, promise);
  return promise;
}

export async function resolveAirtableToken(
  clientId: string | null,
): Promise<ResolvedAirtableCredentials | null> {
  if (clientId) {
    const supabase = getSupabaseServiceRoleClient();
    const { data, error } = await supabase
      .from("client_credentials")
      .select(
        "airtable_token, airtable_workspace_id, airtable_access_token, airtable_refresh_token, airtable_token_expires_at",
      )
      .eq("client_id", clientId)
      .maybeSingle();
    const row = (!error ? (data as CredentialsRow | null) : null) ?? null;

    if (row?.airtable_access_token && row.airtable_refresh_token) {
      const expiresAt = row.airtable_token_expires_at
        ? new Date(row.airtable_token_expires_at).getTime()
        : 0;
      const needsRefresh = expiresAt - Date.now() < 60_000;
      if (!needsRefresh) {
        return {
          token: row.airtable_access_token,
          source: "client",
          workspaceId: row.airtable_workspace_id ?? null,
        };
      }
      try {
        const fresh = await refreshOAuthTokens(clientId, row.airtable_refresh_token);
        return { token: fresh, source: "client", workspaceId: row.airtable_workspace_id ?? null };
      } catch (err) {
        console.error("airtable oauth refresh failed; falling back:", err);
        // fall through to PAT / env
      }
    }

    if (row?.airtable_token) {
      return {
        token: row.airtable_token,
        source: "client",
        workspaceId: row.airtable_workspace_id ?? null,
      };
    }
  }
  const envToken = process.env.AIRTABLE_API_KEY;
  if (envToken) {
    return { token: envToken, source: "env", workspaceId: null };
  }
  return null;
}

// Resolves the token by district: looks up the district's client_id and then
// falls through resolveAirtableToken. Use this from API handlers that know
// which district is being operated on — it's safe to call from the apex
// (super-admin) host where getActiveClient() would return null.
export async function resolveAirtableTokenForDistrict(
  districtId: string,
): Promise<ResolvedAirtableCredentials | null> {
  const supabase = getSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("districts")
    .select("client_id")
    .eq("id", districtId)
    .maybeSingle();
  if (error || !data?.client_id) return resolveAirtableToken(null);
  return resolveAirtableToken(data.client_id as string);
}

export async function saveAirtableToken(args: {
  clientId: string;
  token: string;
  workspaceId?: string | null;
  updatedBy: string | null;
  verifiedAt: Date | null;
}) {
  const supabase = getSupabaseServiceRoleClient();
  const { error } = await supabase
    .from("client_credentials")
    .upsert(
      {
        client_id: args.clientId,
        airtable_token: args.token,
        airtable_workspace_id: args.workspaceId ?? null,
        updated_by: args.updatedBy,
        airtable_verified_at: args.verifiedAt ? args.verifiedAt.toISOString() : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "client_id" },
    );
  if (error) throw new Error(error.message);
}

export async function clearAirtableToken(clientId: string) {
  const supabase = getSupabaseServiceRoleClient();
  await supabase.from("client_credentials").delete().eq("client_id", clientId);
}

export async function saveAirtableOAuthTokens(args: {
  clientId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scopes: string[];
  airtableUserId?: string | null;
  updatedBy?: string | null;
}) {
  const supabase = getSupabaseServiceRoleClient();
  const { error } = await supabase.from("client_credentials").upsert(
    {
      client_id: args.clientId,
      airtable_access_token: args.accessToken,
      airtable_refresh_token: args.refreshToken,
      airtable_token_expires_at: args.expiresAt.toISOString(),
      airtable_scopes: args.scopes,
      airtable_user_id: args.airtableUserId ?? null,
      airtable_connected_at: new Date().toISOString(),
      airtable_verified_at: new Date().toISOString(),
      updated_by: args.updatedBy ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "client_id" },
  );
  if (error) throw new Error(error.message);
}

export async function clearAirtableOAuthTokens(clientId: string) {
  const supabase = getSupabaseServiceRoleClient();
  await supabase
    .from("client_credentials")
    .update({
      airtable_access_token: null,
      airtable_refresh_token: null,
      airtable_token_expires_at: null,
      airtable_scopes: null,
      airtable_user_id: null,
      airtable_connected_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("client_id", clientId);
}

// Returns only the presence + verification timestamp, never the token itself.
export async function getAirtableCredentialStatus(clientId: string): Promise<{
  has_token: boolean;
  has_oauth: boolean;
  workspace_id: string | null;
  verified_at: string | null;
  connected_at: string | null;
  scopes: string[] | null;
}> {
  const supabase = getSupabaseServiceRoleClient();
  const { data } = await supabase
    .from("client_credentials")
    .select(
      "airtable_token, airtable_workspace_id, airtable_verified_at, airtable_access_token, airtable_connected_at, airtable_scopes",
    )
    .eq("client_id", clientId)
    .maybeSingle();
  return {
    has_token: Boolean(data?.airtable_token),
    has_oauth: Boolean(data?.airtable_access_token),
    workspace_id: (data?.airtable_workspace_id as string | null) ?? null,
    verified_at: (data?.airtable_verified_at as string | null) ?? null,
    connected_at: (data?.airtable_connected_at as string | null) ?? null,
    scopes: (data?.airtable_scopes as string[] | null) ?? null,
  };
}
