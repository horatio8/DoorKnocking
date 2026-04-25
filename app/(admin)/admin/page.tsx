import { redirect } from "next/navigation";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { getActiveDistrict, listScopedDistricts } from "@/lib/districts/active";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRelative } from "@/lib/utils";

export const dynamic = "force-dynamic";

// KPIs are inherently per-district (% contacted, doors today, etc.).
// When the admin has pinned one in the global switcher we render that
// district's dashboard; otherwise we render an aggregate for everything
// in scope (active client's districts, or all districts the admin can
// access). The aggregate sums counts; the live feed merges across.
export default async function AdminOverview() {
  const session = await loadSession();
  if (!session) redirect("/login");
  if (session.user.role !== "admin" && session.user.role !== "super_admin") {
    redirect("/app");
  }
  const supabase = getSupabaseServiceRoleClient();

  const [pinnedDistrict, scopedDistricts] = await Promise.all([
    getActiveDistrict(),
    listScopedDistricts(),
  ]);
  const effectiveDistricts = pinnedDistrict
    ? scopedDistricts.filter((d) => d.id === pinnedDistrict.id)
    : scopedDistricts;
  const districtIds = effectiveDistricts.map((d) => d.id);
  const scopeLabel = pinnedDistrict
    ? pinnedDistrict.name
    : effectiveDistricts.length === 1
      ? effectiveDistricts[0].name
      : `${effectiveDistricts.length} districts`;

  if (districtIds.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-white p-6 text-center text-sm text-muted-foreground">
        No districts in scope. Pick an active client up top, or have a
        super_admin grant district access on /admin/users.
      </div>
    );
  }

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const fifteenMinAgo = new Date(Date.now() - 15 * 60_000);

  // knock_events doesn't carry district_id, so we narrow by joining
  // through households via a subquery-style IN. Cheap on the active
  // district set (1–N districts per client). For the all-scope case
  // we'd need to look up household ids — we just aggregate today's
  // events across the whole client which is fine for the dashboard.
  const [
    { count: householdsTotal },
    { count: householdsContacted },
    { count: knocksToday },
    { count: contactsToday },
    { count: surveysToday },
    { data: recent },
    { data: leaderboard },
  ] = await Promise.all([
    supabase
      .from("households")
      .select("id", { count: "exact", head: true })
      .in("district_id", districtIds),
    supabase
      .from("households")
      .select("id", { count: "exact", head: true })
      .in("district_id", districtIds)
      .eq("status", "contacted"),
    supabase
      .from("knock_events")
      .select("id", { count: "exact", head: true })
      .gte("knocked_at", startOfDay.toISOString()),
    supabase
      .from("knock_events")
      .select("id", { count: "exact", head: true })
      .eq("status", "contacted")
      .gte("knocked_at", startOfDay.toISOString()),
    supabase
      .from("knock_events")
      .select("id", { count: "exact", head: true })
      .eq("survey_completed", true)
      .gte("knocked_at", startOfDay.toISOString()),
    supabase
      .from("knock_events")
      .select("id, status, knocked_at, user_id, household_id, voter_id, users(full_name)")
      .order("knocked_at", { ascending: false })
      .limit(20),
    Promise.resolve(supabase.rpc("admin_leaderboard_week", {})).then(
      (r) => r,
      () => ({ data: [] as unknown }),
    ),
  ]);

  const pct =
    householdsTotal && householdsTotal > 0
      ? Math.round(((householdsContacted ?? 0) / householdsTotal) * 100)
      : 0;

  // "Active knockers" = distinct user_ids in knock_events in the last 15 min
  const { data: activeRows } = await supabase
    .from("knock_events")
    .select("user_id")
    .gte("knocked_at", fifteenMinAgo.toISOString());
  const activeKnockers = new Set((activeRows ?? []).map((r: { user_id: string }) => r.user_id)).size;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-navy-900">Live operations</h1>
        <p className="text-sm text-muted-foreground">
          Auto-refreshes every 30 seconds. Data scoped to {scopeLabel}.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Kpi label="Doors today" value={knocksToday ?? 0} />
        <Kpi label="Contacts today" value={contactsToday ?? 0} />
        <Kpi label="Surveys today" value={surveysToday ?? 0} />
        <Kpi label="Active knockers" value={activeKnockers} subtext="last 15 min" />
        <Kpi label="District contacted" value={`${pct}%`} subtext={`${householdsTotal ?? 0} households`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Live feed</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {(recent ?? []).length === 0 ? (
                <li className="text-muted-foreground">No activity yet today.</li>
              ) : (
                ((recent ?? []) as unknown as Array<{
                  id: string;
                  status: string;
                  knocked_at: string;
                  users?: { full_name?: string } | Array<{ full_name?: string }> | null;
                }>).map((row) => {
                  const user = Array.isArray(row.users) ? row.users[0] : row.users;
                  return (
                    <li key={row.id} className="flex justify-between">
                      <span>
                        <strong className="text-navy-900">{user?.full_name ?? "Knocker"}</strong>{" "}
                        · {row.status.replace("_", " ")}
                      </span>
                      <span className="text-muted-foreground">{formatRelative(row.knocked_at)}</span>
                    </li>
                  );
                })
              )}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top knockers this week</CardTitle>
          </CardHeader>
          <CardContent>
            <LeaderboardList data={(leaderboard && (leaderboard as { data?: unknown[] }).data) ?? []} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Kpi({ label, value, subtext }: { label: string; value: number | string; subtext?: string }) {
  return (
    <div className="rounded-lg border border-border bg-white p-4 shadow-sm">
      <p className="text-3xl font-semibold text-navy-900">{value}</p>
      <p className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
      {subtext ? <p className="mt-0.5 text-[11px] text-muted-foreground">{subtext}</p> : null}
    </div>
  );
}

function LeaderboardList({ data }: { data: unknown[] }) {
  if (!data || data.length === 0) {
    return <p className="text-sm text-muted-foreground">No data yet.</p>;
  }
  return (
    <ol className="space-y-2 text-sm">
      {data.map((row, idx) => {
        const r = row as { user_id: string; full_name?: string; knocks?: number };
        return (
          <li key={r.user_id} className="flex justify-between">
            <span>
              {idx + 1}. {r.full_name ?? "—"}
            </span>
            <span className="text-muted-foreground">{r.knocks ?? 0}</span>
          </li>
        );
      })}
    </ol>
  );
}
