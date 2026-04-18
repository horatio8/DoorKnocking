import { redirect } from "next/navigation";
import Link from "next/link";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveClient } from "@/lib/clients/active";
import { Badge } from "@/components/ui/badge";
import { GenerateWalkbooksButton } from "@/components/admin/generate-walkbooks-button";
import { formatRelative } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminWalkbooks() {
  const session = await loadSession();
  if (!session) redirect("/login");
  const supabase = getSupabaseServerClient();
  const activeClient = await getActiveClient();

  // Load every district the active client owns — walkbooks get rolled up
  // across all of them. Falls back to the user's default district if no
  // client is in context (admin on their own subdomain, pre-switcher).
  const { data: districtRows } = activeClient
    ? await supabase
        .from("districts")
        .select("id, name, slug")
        .eq("client_id", activeClient.id)
        .order("name")
    : session.district?.id
      ? await supabase
          .from("districts")
          .select("id, name, slug")
          .eq("id", session.district.id)
      : { data: [] as Array<{ id: string; name: string; slug: string }> };
  const districts = (districtRows ?? []) as Array<{ id: string; name: string; slug: string }>;
  const districtIds = districts.map((d) => d.id);
  const districtNameById = new Map(districts.map((d) => [d.id, d.name]));

  const { data: walkbooks } =
    districtIds.length > 0
      ? await supabase
          .from("walkbooks")
          .select("*, walkbook_assignments(user_id, users(full_name), unassigned_at)")
          .in("district_id", districtIds)
          .order("created_at", { ascending: false })
      : { data: [] as unknown as [] };

  const wbIds = ((walkbooks ?? []) as Array<{ id: string }>).map((w) => w.id);
  const knocksByWalkbook = new Map<string, Array<{ household_id: string; duration_seconds: number | null }>>();
  if (wbIds.length > 0) {
    const { data: events } = await supabase
      .from("knock_events")
      .select("walkbook_id, household_id, duration_seconds")
      .in("walkbook_id", wbIds);
    for (const e of (events ?? []) as Array<{ walkbook_id: string; household_id: string; duration_seconds: number | null }>) {
      const list = knocksByWalkbook.get(e.walkbook_id) ?? [];
      list.push({ household_id: e.household_id, duration_seconds: e.duration_seconds });
      knocksByWalkbook.set(e.walkbook_id, list);
    }
  }

  function metrics(wbId: string, householdCount: number) {
    const events = knocksByWalkbook.get(wbId) ?? [];
    const distinctHouseholds = new Set(events.map((e) => e.household_id));
    const totalSeconds = events
      .map((e) => e.duration_seconds)
      .filter((s): s is number => typeof s === "number" && s > 0)
      .reduce((a, b) => a + b, 0);
    const hours = totalSeconds / 3600;
    const doorsPerHour = hours > 0 ? distinctHouseholds.size / hours : null;
    const completion = householdCount > 0 ? distinctHouseholds.size / householdCount : 0;
    return { doorsPerHour, completion, knocks: events.length, doorsKnocked: distinctHouseholds.size };
  }

  const list = (walkbooks ?? []) as unknown as Array<{
    id: string;
    name: string;
    district_id: string;
    household_count: number;
    status: string;
    kind: string;
    estimated_duration_minutes: number | null;
    target_duration_minutes: number | null;
    created_at: string;
    walkbook_assignments?: Array<{
      unassigned_at: string | null;
      users?: { full_name?: string } | Array<{ full_name?: string }> | null;
    }>;
  }>;

  const total = list.length;
  const totalDoors = list.reduce((sum, w) => sum + (w.household_count ?? 0), 0);
  const totalEstimatedMinutes = list.reduce(
    (sum, w) => sum + (w.estimated_duration_minutes ?? w.target_duration_minutes ?? 0),
    0,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-navy-900">Walkbooks</h1>
          <p className="text-sm text-muted-foreground">
            Geographic clusters of households assigned as a single unit of work.
          </p>
        </div>
        {districts.length > 0 ? (
          <GenerateWalkbooksButton districts={districts} />
        ) : null}
      </div>

      {total > 0 ? (
        <div className="flex flex-wrap gap-x-6 gap-y-1 rounded-md border border-border bg-white px-4 py-3 text-xs text-muted-foreground">
          <span>
            <span className="font-semibold text-navy-900">{total}</span> walkbooks
          </span>
          <span>
            <span className="font-semibold text-navy-900">{totalDoors.toLocaleString()}</span> doors total
          </span>
          <span>
            <span className="font-semibold text-navy-900">
              {Math.round(totalEstimatedMinutes / 60)}h {totalEstimatedMinutes % 60}m
            </span>{" "}
            of walking work planned
          </span>
        </div>
      ) : null}

      {total === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-white p-10 text-center">
          <p className="text-sm text-navy-900">No walkbooks yet.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Use <strong>Generate walkbooks</strong> in the top-right to cluster your households
            into walkable routes.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.map((wb) => {
            const assignment = wb.walkbook_assignments?.find((a) => a.unassigned_at === null);
            const assignedUser = Array.isArray(assignment?.users)
              ? assignment?.users[0]
              : assignment?.users;
            const m = metrics(wb.id, wb.household_count);
            const pct = Math.round(m.completion * 100);
            const est = wb.estimated_duration_minutes ?? wb.target_duration_minutes ?? null;

            return (
              <Link
                key={wb.id}
                href={`/admin/walkbooks/${wb.id}`}
                className="group block rounded-lg border border-border bg-white p-4 transition hover:border-navy-300 hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-navy-900 group-hover:text-navy-700">
                      {wb.name}
                    </p>
                    {districts.length > 1 && districtNameById.has(wb.district_id) ? (
                      <p className="text-[10px] uppercase tracking-widest text-navy-500">
                        {districtNameById.get(wb.district_id)}
                      </p>
                    ) : null}
                  </div>
                  <StatusChip status={wb.status} kind={wb.kind} />
                </div>

                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                  <span>{wb.household_count} doors</span>
                  {est ? <span>~{est}m</span> : null}
                  {m.doorsPerHour != null ? <span>{m.doorsPerHour.toFixed(1)} doors/hr</span> : null}
                </div>

                <div className="mt-3">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>
                      {m.doorsKnocked} of {wb.household_count} knocked
                    </span>
                    <span>{pct}%</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-navy-50">
                    <div
                      className="h-full bg-navy-900 transition-all"
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {assignedUser?.full_name ? `→ ${assignedUser.full_name}` : "Unassigned"}
                  </span>
                  <span>{formatRelative(wb.created_at)}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatusChip({ status, kind }: { status: string; kind?: string }) {
  if (kind === "dynamic") return <Badge variant="secondary">Dynamic</Badge>;
  if (kind === "custom") return <Badge variant="secondary">Custom</Badge>;
  switch (status) {
    case "complete":
      return <Badge variant="success">Complete</Badge>;
    case "in_progress":
      return <Badge variant="warning">In progress</Badge>;
    case "open":
    default:
      return <Badge variant="secondary">Open</Badge>;
  }
}
