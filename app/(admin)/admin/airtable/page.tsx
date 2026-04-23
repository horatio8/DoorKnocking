import { redirect } from "next/navigation";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveClient } from "@/lib/clients/active";
import { Badge } from "@/components/ui/badge";
import { AirtableOnboarding } from "@/components/admin/airtable-onboarding";
import { formatRelative } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface DistrictRow {
  id: string;
  slug: string;
  name: string;
  airtable_base_id: string | null;
  airtable_voters_table_id: string | null;
  airtable_field_mapping: Record<string, string | null> | null;
  airtable_is_canonical: boolean | null;
  airtable_import_status: string;
  airtable_last_imported_at: string | null;
  airtable_last_error: string | null;
  airtable_last_import_summary: Record<string, unknown> | null;
}

interface ImportFileRow {
  id: string;
  original_filename: string;
  row_count: number | null;
  status: string;
  created_at: string;
  imported_at: string | null;
  uploaded_by: string | null;
  error_message: string | null;
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
      "id, slug, name, airtable_base_id, airtable_voters_table_id, airtable_field_mapping, airtable_is_canonical, airtable_import_status, airtable_last_imported_at, airtable_last_error, airtable_last_import_summary",
    )
    .order("name");
  if (client) query.eq("client_id", client.id);
  const { data } = await query;
  const districts = (data ?? []) as DistrictRow[];

  const selectedId = searchParams?.district ?? districts[0]?.id ?? null;
  const selected = districts.find((d) => d.id === selectedId) ?? null;

  const { data: imports } = selected
    ? await supabase
        .from("import_files")
        .select("id, original_filename, row_count, status, created_at, imported_at, uploaded_by, error_message")
        .eq("district_id", selected.id)
        .order("created_at", { ascending: false })
        .limit(10)
    : { data: [] };
  const importHistory = (imports ?? []) as ImportFileRow[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-navy-900">
          Airtable connections
        </h1>
        <p className="text-sm text-muted-foreground">
          Upload a voter file to spin up a canonical Airtable base automatically — or connect
          an existing base with the legacy wizard. Re-run anytime to refresh data.
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

        <section className="min-w-0 space-y-6">
          {selected ? (
            <>
              <AirtableOnboarding
                districtId={selected.id}
                districtName={selected.name}
                initialBaseId={selected.airtable_base_id ?? ""}
                initialTableId={selected.airtable_voters_table_id ?? ""}
                initialMapping={selected.airtable_field_mapping ?? null}
                hasCanonicalBase={Boolean(selected.airtable_is_canonical)}
                status={selected.airtable_import_status}
                lastImportedAt={selected.airtable_last_imported_at}
                lastError={selected.airtable_last_error}
                lastSummary={selected.airtable_last_import_summary}
                lastRelative={formatRelative(selected.airtable_last_imported_at)}
              />
              <ImportHistory rows={importHistory} />
            </>
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

function ImportHistory({ rows }: { rows: ImportFileRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="rounded-lg border border-border bg-white p-4">
      <h2 className="font-medium text-navy-900">Import history</h2>
      <p className="text-xs text-muted-foreground">
        Recent voter-file uploads for this district.
      </p>
      <table className="mt-3 w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-widest text-navy-500">
          <tr>
            <th className="py-1.5">File</th>
            <th className="py-1.5">Rows</th>
            <th className="py-1.5">Status</th>
            <th className="py-1.5">Uploaded</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-border">
              <td className="py-2 pr-3 font-mono text-xs text-navy-700">{r.original_filename}</td>
              <td className="py-2 pr-3 text-xs text-muted-foreground">{r.row_count ?? "—"}</td>
              <td className="py-2 pr-3"><ImportStatusChip status={r.status} /></td>
              <td className="py-2 text-xs text-muted-foreground">{formatRelative(r.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ImportStatusChip({ status }: { status: string }) {
  switch (status) {
    case "imported":
      return <Badge variant="success">Imported</Badge>;
    case "pushed":
      return <Badge variant="warning">Pushed to Airtable</Badge>;
    case "failed":
      return <Badge variant="destructive">Failed</Badge>;
    case "cancelled":
      return <Badge variant="secondary">Cancelled</Badge>;
    case "parsed":
      return <Badge variant="secondary">Parsed</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
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
