import Link from "next/link";
import { redirect } from "next/navigation";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { getActiveClient } from "@/lib/clients/active";
import { Badge } from "@/components/ui/badge";
import { NewScriptButton } from "@/components/admin/new-script-button";
import { formatRelative } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminScriptsPage() {
  const session = await loadSession();
  if (!session) redirect("/login");
  if (session.user.role !== "admin" && session.user.role !== "super_admin") redirect("/app");

  const supabase = getSupabaseServiceRoleClient();
  const client = await getActiveClient();
  const { data: districts } = client
    ? await supabase
        .from("districts")
        .select("id, name")
        .eq("client_id", client.id)
        .eq("active", true)
        .order("name")
    : session.district
      ? await supabase.from("districts").select("id, name").eq("id", session.district.id)
      : { data: [] as Array<{ id: string; name: string }> };
  const dList = (districts ?? []) as Array<{ id: string; name: string }>;
  const districtIds = dList.map((d) => d.id);
  const defaultDistrictId = session.district?.id ?? dList[0]?.id ?? null;

  const { data: scripts } = districtIds.length
    ? await supabase
        .from("scripts")
        .select("id, name, status, priority, district_id, updated_at, published_at")
        .in("district_id", districtIds)
        .order("status", { ascending: true })
        .order("priority", { ascending: false })
        .order("updated_at", { ascending: false })
    : { data: [] };

  const rows = (scripts ?? []) as Array<{
    id: string;
    name: string;
    status: "draft" | "active" | "paused" | "archived";
    priority: number;
    district_id: string;
    updated_at: string;
    published_at: string | null;
  }>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-navy-900">Scripts</h1>
          <p className="text-sm text-muted-foreground">
            Talking-points your volunteers can pull up at the door. Attach a script to a
            walkbook from the walkbook detail page to surface it in the preview.
          </p>
        </div>
        <NewScriptButton districts={dList} defaultDistrictId={defaultDistrictId} />
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-white p-10 text-center text-sm text-muted-foreground">
          No scripts yet. Hit <strong>New script</strong> to draft one.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((s) => (
            <Link
              key={s.id}
              href={`/admin/scripts/${s.id}/edit`}
              className="group block rounded-lg border border-border bg-white p-4 transition hover:border-navy-300 hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="truncate font-medium text-navy-900">{s.name}</p>
                <StatusBadge status={s.status} />
              </div>
              <div className="mt-2 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                <span>priority {s.priority}</span>
                <span>
                  {s.published_at
                    ? `published ${formatRelative(s.published_at)}`
                    : `updated ${formatRelative(s.updated_at)}`}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: "draft" | "active" | "paused" | "archived" }) {
  if (status === "active") return <Badge variant="success">Active</Badge>;
  if (status === "paused") return <Badge variant="warning">Paused</Badge>;
  if (status === "archived") return <Badge variant="secondary">Archived</Badge>;
  return <Badge variant="secondary">Draft</Badge>;
}
