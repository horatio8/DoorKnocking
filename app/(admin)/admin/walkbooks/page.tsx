import { redirect } from "next/navigation";
import Link from "next/link";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { getActiveClient } from "@/lib/clients/active";
import { Badge } from "@/components/ui/badge";
import { GenerateWalkbooksButton } from "@/components/admin/generate-walkbooks-button";
import {
  WalkbookOverviewMap,
  type WalkbookViz,
} from "@/components/admin/walkbook-overview-map";
import { StepBadge } from "@/components/admin/step-badge";
import { walkbookColor } from "@/lib/walkbooks/color";
import { formatRelative } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminWalkbooks() {
  const session = await loadSession();
  if (!session) redirect("/login");
  if (session.user.role !== "admin" && session.user.role !== "super_admin") {
    redirect("/app");
  }
  // Page is server-gated to admins; service-role client avoids any RLS
  // edge-cases with the SSR anon client and is safe here.
  const supabase = getSupabaseServiceRoleClient();
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

  // Walkbooks first, bare. The previous join (walkbook_assignments + nested
  // users) was returning zero rows whenever there was no matching assignment
  // — a quirk of how PostgREST handles deeply-nested optional joins under
  // some RLS conditions. Splitting into two queries is bulletproof.
  let walkbookRows: Array<{
    id: string;
    name: string;
    district_id: string;
    household_count: number;
    status: string;
    kind: string;
    travel_mode: string;
    estimated_duration_minutes: number | null;
    target_duration_minutes: number | null;
    created_at: string;
  }> = [];
  let walkbooksError: string | null = null;
  if (districtIds.length > 0) {
    const { data, error } = await supabase
      .from("walkbooks")
      .select(
        "id, name, district_id, household_count, status, kind, travel_mode, estimated_duration_minutes, target_duration_minutes, created_at",
      )
      .in("district_id", districtIds)
      .order("created_at", { ascending: false });
    if (error) {
      walkbooksError = error.message;
      console.error("/admin/walkbooks: walkbooks query failed", error);
    } else {
      walkbookRows = (data ?? []) as typeof walkbookRows;
    }
  }

  // Active assignments — separate query, joined in JS.
  const wbIds = walkbookRows.map((w) => w.id);
  const assignmentByWalkbook = new Map<string, { full_name: string | null }>();
  if (wbIds.length > 0) {
    const { data: assigns } = await supabase
      .from("walkbook_assignments")
      .select("walkbook_id, user_id, users(full_name)")
      .in("walkbook_id", wbIds)
      .is("unassigned_at", null);
    for (const a of (assigns ?? []) as Array<{
      walkbook_id: string;
      user_id: string;
      users: { full_name: string | null } | Array<{ full_name: string | null }> | null;
    }>) {
      const u = Array.isArray(a.users) ? a.users[0] : a.users;
      assignmentByWalkbook.set(a.walkbook_id, { full_name: u?.full_name ?? null });
    }
  }

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

  // For the overview map: ordered (lat,lng) for every stop in every walkbook.
  // Two queries (joins + lat lookup) — same split-query pattern that fixed
  // the empty-list bug. We fetch household rows in batch, then assemble.
  const overviewWalkbooks: WalkbookViz[] = [];
  if (wbIds.length > 0) {
    const { data: stopRows } = await supabase
      .from("walkbook_households")
      .select("walkbook_id, order_index, household_id")
      .in("walkbook_id", wbIds)
      .order("order_index");
    const allHHIds = Array.from(
      new Set(((stopRows ?? []) as Array<{ household_id: string }>).map((r) => r.household_id)),
    );
    const coordById = new Map<string, { lat: number; lng: number }>();
    if (allHHIds.length > 0) {
      // Chunk to keep IN clause small.
      const CHUNK = 500;
      for (let i = 0; i < allHHIds.length; i += CHUNK) {
        const slice = allHHIds.slice(i, i + CHUNK);
        const { data } = await supabase
          .from("households")
          .select("id, lat, lng")
          .in("id", slice)
          .not("lat", "is", null)
          .not("lng", "is", null);
        for (const h of (data ?? []) as Array<{ id: string; lat: number; lng: number }>) {
          coordById.set(h.id, { lat: Number(h.lat), lng: Number(h.lng) });
        }
      }
    }
    const stopsByWalkbook = new Map<string, Array<{ lat: number; lng: number }>>();
    for (const r of (stopRows ?? []) as Array<{ walkbook_id: string; household_id: string; order_index: number }>) {
      const c = coordById.get(r.household_id);
      if (!c) continue;
      const list = stopsByWalkbook.get(r.walkbook_id) ?? [];
      list.push(c);
      stopsByWalkbook.set(r.walkbook_id, list);
    }
    for (const w of walkbookRows) {
      const stops = stopsByWalkbook.get(w.id) ?? [];
      if (stops.length > 0) overviewWalkbooks.push({ id: w.id, name: w.name, stops });
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

  const list = walkbookRows;
  const total = list.length;
  const totalDoors = list.reduce((sum, w) => sum + (w.household_count ?? 0), 0);
  const walkingMinutes = list
    .filter((w) => w.travel_mode !== "driving")
    .reduce((sum, w) => sum + (w.estimated_duration_minutes ?? w.target_duration_minutes ?? 0), 0);
  const drivingMinutes = list
    .filter((w) => w.travel_mode === "driving")
    .reduce((sum, w) => sum + (w.estimated_duration_minutes ?? w.target_duration_minutes ?? 0), 0);
  function hm(mins: number): string {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m}m`;
    return `${h}h ${m}m`;
  }

  // Per-step counters for the workflow header.
  const assignedCount = assignmentByWalkbook.size;
  const unassignedCount = Math.max(0, total - assignedCount);
  const hasWalkbooks = total > 0;
  const step1Active = !hasWalkbooks;
  const step2Active = hasWalkbooks && unassignedCount > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-navy-900">Walkbooks</h1>
          <p className="text-sm text-muted-foreground">
            Two steps: generate walkable clusters, then hand them to volunteers.
          </p>
        </div>
        <Link
          href="/admin/walkbooks/batches"
          className="text-xs text-muted-foreground underline"
        >
          Batch history
        </Link>
      </div>

      {districts.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2">
          <section
            className={`rounded-lg border bg-white p-4 transition ${
              step1Active ? "border-navy-300 shadow-sm" : "border-border"
            }`}
          >
            <div className="flex items-start gap-3">
              <StepBadge number={1} active={step1Active} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-navy-900">Generate walkbooks</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {hasWalkbooks
                    ? `${total} walkbooks covering ${totalDoors.toLocaleString()} doors. Regenerate when the household set changes.`
                    : "Cluster this client's households into walkable routes. Pick a district, household filter, and walkbook size."}
                </p>
              </div>
            </div>
            <div className="mt-3">
              <GenerateWalkbooksButton districts={districts} />
            </div>
          </section>

          <section
            className={`rounded-lg border bg-white p-4 transition ${
              step2Active
                ? "border-navy-300 shadow-sm"
                : hasWalkbooks
                  ? "border-border"
                  : "border-border opacity-60"
            }`}
          >
            <div className="flex items-start gap-3">
              <StepBadge number={2} active={step2Active} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-navy-900">Assign walkbooks</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {!hasWalkbooks
                    ? "Generate walkbooks first — this step unlocks once there's something to hand out."
                    : unassignedCount === 0
                      ? `All ${total} walkbooks assigned. Re-open the assignment screen to reshuffle.`
                      : `${unassignedCount} unassigned of ${total}. Pick volunteers, then walkbooks, then distribute.`}
                </p>
              </div>
            </div>
            <div className="mt-3">
              <Link
                href="/admin/walkbooks/assign"
                aria-disabled={!hasWalkbooks}
                className={`inline-flex items-center rounded-md border px-3 py-1.5 text-sm font-medium ${
                  hasWalkbooks
                    ? "border-navy-900 bg-navy-900 text-white hover:bg-navy-800"
                    : "pointer-events-none border-border bg-navy-50 text-navy-400"
                }`}
              >
                Open assignment screen →
              </Link>
            </div>
          </section>
        </div>
      ) : null}

      {total > 0 ? (
        <div className="flex flex-wrap gap-x-6 gap-y-1 rounded-md border border-border bg-white px-4 py-3 text-xs text-muted-foreground">
          <span>
            <span className="font-semibold text-navy-900">{total}</span> walkbooks
          </span>
          <span>
            <span className="font-semibold text-navy-900">{totalDoors.toLocaleString()}</span> doors total
          </span>
          {walkingMinutes > 0 ? (
            <span>
              <span className="font-semibold text-navy-900">{hm(walkingMinutes)}</span> walking
            </span>
          ) : null}
          {drivingMinutes > 0 ? (
            <span>
              <span className="font-semibold text-navy-900">{hm(drivingMinutes)}</span> driving
            </span>
          ) : null}
        </div>
      ) : null}

      {overviewWalkbooks.length > 0 ? (
        <WalkbookOverviewMap walkbooks={overviewWalkbooks} />
      ) : null}

      {total === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-white p-10 text-center">
          <p className="text-sm text-navy-900">No walkbooks yet — start at step 1 above.</p>
          <p className="mt-4 inline-block rounded-full border border-border bg-navy-50/40 px-3 py-1 text-[11px] text-muted-foreground">
            scope: client = <strong>{activeClient?.name ?? "(none)"}</strong> ·{" "}
            districts queried = <strong>{districtIds.length}</strong>
            {walkbooksError ? <> · <span className="text-crimson">error: {walkbooksError}</span></> : null}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-lg font-semibold text-navy-900">Current walkbooks</h2>
            <p className="text-xs text-muted-foreground">
              {assignedCount} assigned · {unassignedCount} unassigned
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.map((wb) => {
            const assignedUser = assignmentByWalkbook.get(wb.id) ?? null;
            const m = metrics(wb.id, wb.household_count);
            const pct = Math.round(m.completion * 100);
            const est = wb.estimated_duration_minutes ?? wb.target_duration_minutes ?? null;

            return (
              <Link
                key={wb.id}
                href={`/admin/walkbooks/${wb.id}`}
                className="group block rounded-lg border border-l-4 border-border bg-white p-4 transition hover:border-navy-300 hover:shadow-sm"
                style={{ borderLeftColor: walkbookColor(wb.id) }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block h-2.5 w-2.5 flex-none rounded-full"
                        style={{ backgroundColor: walkbookColor(wb.id) }}
                        aria-hidden
                      />
                      <p className="truncate font-medium text-navy-900 group-hover:text-navy-700">
                        {wb.name}
                      </p>
                    </div>
                    {districts.length > 1 && districtNameById.has(wb.district_id) ? (
                      <p className="mt-0.5 text-[10px] uppercase tracking-widest text-navy-500">
                        {districtNameById.get(wb.district_id)}
                      </p>
                    ) : null}
                  </div>
                  <StatusChip status={wb.status} kind={wb.kind} />
                </div>

                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                  <span>{wb.household_count} doors</span>
                  {est ? (
                    <span>
                      ~{est}m {wb.travel_mode === "driving" ? "driving" : "walking"}
                    </span>
                  ) : null}
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
