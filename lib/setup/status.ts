// Computes which steps of the setup wizard are already satisfied for the
// active client. Runs on the server; safe to call from server components.

import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveClient, type ActiveClient } from "@/lib/clients/active";
import { getAirtableCredentialStatus } from "@/lib/airtable/credentials";
import type { AppUser } from "@/lib/types";

export type SetupStepId =
  | "client"
  | "district"
  | "airtable_token"
  | "airtable_mapping"
  | "users"
  | "done";

export interface SetupStepState {
  id: SetupStepId;
  label: string;
  description: string;
  complete: boolean;
}

export interface SetupDistrictSummary {
  id: string;
  name: string;
  slug: string;
  country: string | null;
  region: string | null;
  airtable_base_id: string | null;
  airtable_voters_table_id: string | null;
  airtable_field_mapping: Record<string, string | null> | null;
  airtable_import_status: string;
  airtable_last_imported_at: string | null;
  airtable_last_error: string | null;
  airtable_last_import_summary: Record<string, unknown> | null;
}

export interface SetupStatus {
  role: AppUser["role"];
  client: ActiveClient | null;
  canCreateClient: boolean;
  districts: SetupDistrictSummary[];
  primaryDistrict: SetupDistrictSummary | null;
  airtable: { has_token: boolean; workspace_id: string | null; verified_at: string | null };
  teamCount: number;
  steps: SetupStepState[];
  firstIncomplete: SetupStepId;
  allComplete: boolean;
}

export async function getSetupStatus(user: AppUser): Promise<SetupStatus> {
  const client = await getActiveClient();
  const supabase = getSupabaseServerClient();

  let districts: SetupDistrictSummary[] = [];
  if (client) {
    const { data } = await supabase
      .from("districts")
      .select(
        "id, slug, name, country, region, airtable_base_id, airtable_voters_table_id, airtable_field_mapping, airtable_import_status, airtable_last_imported_at, airtable_last_error, airtable_last_import_summary",
      )
      .eq("client_id", client.id)
      .order("created_at", { ascending: true });
    districts = (data ?? []) as SetupDistrictSummary[];
  }
  const primaryDistrict = districts[0] ?? null;

  const airtable = client
    ? await getAirtableCredentialStatus(client.id)
    : { has_token: false, workspace_id: null, verified_at: null };

  // Count any other users that can access this client. "Seeded" admins
  // (the current user) don't count toward having invited a team.
  let teamCount = 0;
  if (client) {
    const { data: members } = await supabase
      .from("users")
      .select("id, role, client_access")
      .neq("id", user.id);
    teamCount = (members ?? []).filter((m: { role: string; client_access: string[] | null }) => {
      if (m.role === "super_admin") return false;
      return Array.isArray(m.client_access) ? m.client_access.includes(client.id) : true;
    }).length;
  }

  const hasClient = Boolean(client);
  const hasDistrict = districts.length > 0;
  const hasToken = airtable.has_token;
  const mappingReady = primaryDistrict?.airtable_import_status === "ready";
  const hasTeam = teamCount > 0;

  const steps: SetupStepState[] = [
    {
      id: "client",
      label: "Client profile",
      description: "Name, slug, and brand colors for this campaign.",
      complete: hasClient,
    },
    {
      id: "district",
      label: "First district",
      description: "At least one district to scope your voter file.",
      complete: hasClient && hasDistrict,
    },
    {
      id: "airtable_token",
      label: "Airtable credentials",
      description: "Personal Access Token used for voter-file sync.",
      complete: hasClient && hasToken,
    },
    {
      id: "airtable_mapping",
      label: "Airtable mapping & import",
      description: "Map fields for the voter table and run the first import.",
      complete: hasClient && hasDistrict && mappingReady,
    },
    {
      id: "users",
      label: "Invite your team",
      description: "Send invites so admins and knockers can sign in.",
      complete: hasClient && hasTeam,
    },
  ];

  const firstIncomplete: SetupStepId = (steps.find((s) => !s.complete)?.id ?? "done") as SetupStepId;
  const allComplete = steps.every((s) => s.complete);

  return {
    role: user.role,
    client,
    canCreateClient: user.role === "super_admin",
    districts,
    primaryDistrict,
    airtable,
    teamCount,
    steps,
    firstIncomplete,
    allComplete,
  };
}
