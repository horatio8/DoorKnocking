import { redirect } from "next/navigation";
import { loadSession } from "@/lib/auth/session";
import { getActiveClient } from "@/lib/clients/active";
import { getAirtableCredentialStatus } from "@/lib/airtable/credentials";
import { isOAuthEnabled } from "@/lib/airtable/oauth";
import { AirtableCredentialsCard } from "@/components/admin/airtable-credentials-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams?: { airtable_connected?: string; airtable_error?: string };
}) {
  const session = await loadSession();
  if (!session) redirect("/login");
  if (session.user.role !== "admin" && session.user.role !== "super_admin") {
    redirect("/admin");
  }
  const client = await getActiveClient();
  if (!client) {
    return (
      <div className="rounded-md border border-dashed border-border bg-white p-6 text-sm text-muted-foreground">
        Open a client subdomain to manage its settings. (Super-admins can also manage clients at
        <a className="ml-1 underline" href="/admin/clients">/admin/clients</a>.)
      </div>
    );
  }

  const airtable = await getAirtableCredentialStatus(client.id);
  const oauthEnabled = isOAuthEnabled();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-navy-900">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Configuration for <strong>{client.name}</strong>. Everything here is scoped to this client only.
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

      <AirtableCredentialsCard
        clientId={client.id}
        clientName={client.name}
        hasToken={airtable.has_token}
        hasOAuth={airtable.has_oauth}
        oauthEnabled={oauthEnabled}
        workspaceId={airtable.workspace_id}
        verifiedAt={airtable.verified_at}
        connectedAt={airtable.connected_at}
      />

      <Card>
        <CardHeader>
          <CardTitle>Brand</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <span className="text-muted-foreground">Slug / subdomain:</span>{" "}
            <span className="font-mono">{client.slug}.campaignos.com</span>
          </p>
          <p>
            <span className="text-muted-foreground">Primary color:</span>{" "}
            <span className="inline-flex items-center gap-1">
              <span
                className="inline-block h-3 w-3 rounded"
                style={{ backgroundColor: client.brand?.primary_color ?? "#0B1F3A" }}
              />
              <span className="font-mono">{client.brand?.primary_color ?? "#0B1F3A"}</span>
            </span>
          </p>
          <p>
            <span className="text-muted-foreground">Accent color:</span>{" "}
            <span className="inline-flex items-center gap-1">
              <span
                className="inline-block h-3 w-3 rounded"
                style={{ backgroundColor: client.brand?.accent_color ?? "#B5121B" }}
              />
              <span className="font-mono">{client.brand?.accent_color ?? "#B5121B"}</span>
            </span>
          </p>
          {session.user.role === "super_admin" ? (
            <p className="pt-2 text-xs text-muted-foreground">
              Edit these at <a className="underline" href="/admin/clients">/admin/clients</a>.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
