import { redirect } from "next/navigation";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveClient } from "@/lib/clients/active";
import { Badge } from "@/components/ui/badge";
import { AirtableConnectionWizard } from "@/components/admin/airtable-wizard";
import { formatRelative } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface DistrictRow {
  id: string;
  slug: string;
  name: string;
  airtable_base_id: string | null;
  airtable_voters_table_id: string | null;
  airtable_field_mapping: Record<string, string | null> | null;
  airtable_import_status: string;
  airtable_last_imported_at: string | null;
  airtable_last_error: string | null;
  airtable_last_import_summary: Record<string, unknown> | null;
}

export default async function AdminAirtablePage({
  searchParams,
}: {
  searchParams?: { district?: string };
}) {
  const session = await loadSession();
  if (!session) redirect("/login");
  if (session.user.role !== "admin" && session.user.role !== "super_admin") {
    redirect("/admin");
  }

  const supabase = getSupabaseServerClient();
  const client = await getActiveClient();

  const query = supabase
    .from("districts")
    .select(
      "id, slug, name, airtable_base_id, airtable_voters_table_id, airtable_field_mapping, airtable_import_status, airtable_last_imported_at, airtable_last_error, airtable_last_import_summary",
    )
    .order("name");
  if (client) query.eq("client_id", client.id);
  const { data } = await query;
  const districts = (data ?? []) as DistrictRow[];

  const selectedId = searchParams?.district ?? districts[0]?.id ?? null;
  const selected = districts.find((d) => d.id === selectedId) ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-navy-900">
          Airtable connections
        </h1>
        <p className="text-sm text-muted-foreground">
          Connect each district&apos;s voter file Airtable, let Claude propose the field mapping,
          adjust as needed, then import. Re-run anytime to refresh data.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="space-y-1">
          <p className="px-2 text-xs uppercase tracking-widest text-navy-500">Districts</p>
          {districts.length === 0 ? (
            <p className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
              No districts yet. Create one in the Districts section first.
            </p>
          ) : (
            districts.map((d) => (
              <a
                key={d.id}
                href={`/admin/airtable?district=${d.id}`}
                className={`flex flex-col gap-0.5 rounded-md px-3 py-2 text-sm transition ${
                  d.id === selectedId
                    ? "bg-navy-50 font-medium text-navy-900"
                    : "text-navy-700 hover:bg-navy-50/60"
                }`}
              >
                <span>{d.name}</span>
                <StatusChip status={d.airtable_import_status} />
              </a>
            ))
          )}
        </aside>

        <section className="min-w-0">
          {selected ? (
            <AirtableConnectionWizard
              districtId={selected.id}
              districtName={selected.name}
              initialBaseId={selected.airtable_base_id ?? ""}
              initialTableId={selected.airtable_voters_table_id ?? ""}
              initialMapping={selected.airtable_field_mapping ?? null}
              status={selected.airtable_import_status}
              lastImportedAt={selected.airtable_last_imported_at}
              lastError={selected.airtable_last_error}
              lastSummary={selected.airtable_last_import_summary}
              lastRelative={formatRelative(selected.airtable_last_imported_at)}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Pick a district from the left to set up its Airtable connection.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  switch (status) {
    case "ready":
      return <Badge variant="success">Ready</Badge>;
    case "importing":
      return <Badge variant="warning">Importing…</Badge>;
    case "error":
      return <Badge variant="destructive">Error</Badge>;
    case "mapping_pending":
      return <Badge variant="warning">Mapping pending</Badge>;
    default:
      return <Badge variant="secondary">Unconfigured</Badge>;
  }
}
