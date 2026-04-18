// Resolve an Airtable PAT for a given client. Looks at client_credentials
// first (stored per-client), falls back to the AIRTABLE_API_KEY env var so
// the default Teller client keeps working without a DB write.
//
// Server-only. Never export the resolved token to the client — call this
// inside API handlers only.

import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";

export interface ResolvedAirtableCredentials {
  token: string;
  source: "client" | "env";
  workspaceId: string | null;
}

export async function resolveAirtableToken(
  clientId: string | null,
): Promise<ResolvedAirtableCredentials | null> {
  if (clientId) {
    const supabase = getSupabaseServiceRoleClient();
    const { data, error } = await supabase
      .from("client_credentials")
      .select("airtable_token, airtable_workspace_id")
      .eq("client_id", clientId)
      .maybeSingle();
    if (!error && data?.airtable_token) {
      return {
        token: data.airtable_token as string,
        source: "client",
        workspaceId: (data.airtable_workspace_id as string | null) ?? null,
      };
    }
  }
  const envToken = process.env.AIRTABLE_API_KEY;
  if (envToken) {
    return { token: envToken, source: "env", workspaceId: null };
  }
  return null;
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

// Returns only the presence + verification timestamp, never the token itself.
export async function getAirtableCredentialStatus(clientId: string): Promise<{
  has_token: boolean;
  workspace_id: string | null;
  verified_at: string | null;
}> {
  const supabase = getSupabaseServiceRoleClient();
  const { data } = await supabase
    .from("client_credentials")
    .select("airtable_token, airtable_workspace_id, airtable_verified_at")
    .eq("client_id", clientId)
    .maybeSingle();
  return {
    has_token: Boolean(data?.airtable_token),
    workspace_id: (data?.airtable_workspace_id as string | null) ?? null,
    verified_at: (data?.airtable_verified_at as string | null) ?? null,
  };
}
