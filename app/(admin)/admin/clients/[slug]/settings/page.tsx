import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { getAirtableCredentialStatus } from "@/lib/airtable/credentials";
import { isOAuthEnabled } from "@/lib/airtable/oauth";
import { AirtableCredentialsCard } from "@/components/admin/airtable-credentials-card";
import { ClientDetailsCard, type ClientDetails } from "@/components/admin/client-details-card";
import { ClientDistricts, type DistrictRow } from "@/components/admin/client-districts";
import { VolunteerFlowCard } from "@/components/admin/volunteer-flow-card";

export const dynamic = "force-dynamic";

interface ClientRow {
  id: string;
  slug: string;
  name: string;
  brand: { primary_color?: string; accent_color?: string; short_name?: string } | null;
  contact_email: string | null;
  active: boolean;
  use_v_flow?: boolean | null;
}

export default async function SuperAdminClientSettings({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams?: { airtable_connected?: string; airtable_error?: string };
}) {
  const session = await loadSession();
  if (!session) redirect("/login");
  if (session.user.role !== "super_admin") redirect("/admin");

  const supabase = getSupabaseServiceRoleClient();
  // use_v_flow may not exist on the DB yet — select it tolerantly so the
  // page still renders before migration 20260425000007 has been applied.
  let row: ClientRow | null = null;
  {
    const withFlag = await supabase
      .from("clients")
      .select("id, slug, name, brand, contact_email, active, use_v_flow")
      .eq("slug", params.slug)
      .maybeSingle();
    if (withFlag.data) {
      row = withFlag.data as ClientRow;
    } else if ((withFlag.error as { code?: string } | null)?.code === "42703") {
      const fallback = await supabase
        .from("clients")
        .select("id, slug, name, brand, contact_email, active")
        .eq("slug", params.slug)
        .maybeSingle();
      row = (fallback.data as ClientRow) ?? null;
    }
  }
  if (!row) notFound();

  const [{ data: districtRows }, airtable] = await Promise.all([
    supabase
      .from("districts")
      .select(
        "id, slug, name, country, region, timezone, active, airtable_base_id, airtable_voters_table_id, airtable_import_status",
      )
      .eq("client_id", row.id)
      .order("created_at"),
    getAirtableCredentialStatus(row.id),
  ]);
  const districts = (districtRows ?? []) as DistrictRow[];
  const oauthEnabled = isOAuthEnabled();

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs text-muted-foreground">
          <Link href="/admin/clients" className="underline">
            Clients
          </Link>{" "}
          / <span className="font-mono">{row.slug}</span>
        </div>
        <h1 className="font-serif text-2xl font-semibold text-navy-900">{row.name}</h1>
        <p className="text-sm text-muted-foreground">
          Per-client settings. Changes here only affect <strong>{row.name}</strong>.
        </p>
      </div>

      {searchParams?.airtable_connected ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          Airtable connected successfully.
        </div>
      ) : null}
      {searchParams?.airtable_error ? (
        <div className="rounded-md border border-crimson/30 bg-crimson/5 p-3 text-sm text-crimson">
          {searchParams.airtable_error}
        </div>
      ) : null}

      <ClientDetailsCard client={row as ClientDetails} />

      <VolunteerFlowCard
        clientId={row.id}
        clientName={row.name}
        initialEnabled={row.use_v_flow ?? true}
      />

      <AirtableCredentialsCard
        clientId={row.id}
        clientName={row.name}
        hasToken={airtable.has_token}
        hasOAuth={airtable.has_oauth}
        oauthEnabled={oauthEnabled}
        workspaceId={airtable.workspace_id}
        verifiedAt={airtable.verified_at}
        connectedAt={airtable.connected_at}
      />

      <ClientDistricts clientId={row.id} clientName={row.name} districts={districts} />
    </div>
  );
}
