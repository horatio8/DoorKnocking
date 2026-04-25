import Link from "next/link";
import { redirect } from "next/navigation";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { getActiveDistrict, listScopedDistricts } from "@/lib/districts/active";
import { Badge } from "@/components/ui/badge";
import { NewSurveyButton } from "@/components/admin/new-survey-button";
import { formatRelative } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminSurveys() {
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
  // Full client scope is the source of truth for the New-Survey picker
  // and the "districts without active surveys" banner. We always query
  // surveys across the full scope so the banner stays accurate even
  // when the admin has pinned one district — `displayIds` below
  // narrows what's *rendered* in the section grids.
  const districtOptions = scopedDistricts.map((d) => ({ id: d.id, name: d.name }));
  const districtIds = districtOptions.map((d) => d.id);
  const displayIds = pinnedDistrict ? new Set([pinnedDistrict.id]) : null;
  const defaultDistrictId = pinnedDistrict?.id ?? districtOptions[0]?.id ?? null;

  // Pull surveys + per-survey counts.
  const { data: surveys } = districtIds.length
    ? await supabase
        .from("surveys")
        .select(
          "id, name, slug, description, visibility, priority, status, current_version, district_id, published_at, updated_at",
        )
        .in("district_id", districtIds)
        .order("status", { ascending: true })
        .order("priority", { ascending: false })
        .order("updated_at", { ascending: false })
    : { data: [] };
  const rows = (surveys ?? []) as Array<{
    id: string;
    name: string;
    slug: string | null;
    description: string | null;
    visibility: string;
    priority: number;
    status: "draft" | "active" | "paused" | "archived";
    current_version: number;
    district_id: string;
    published_at: string | null;
    updated_at: string;
  }>;

  const questionCounts = new Map<string, number>();
  const responseCounts = new Map<string, number>();
  if (rows.length > 0) {
    const ids = rows.map((r) => r.id);
    const { data: qs } = await supabase
      .from("survey_questions")
      .select("survey_id")
      .in("survey_id", ids);
    for (const q of (qs ?? []) as Array<{ survey_id: string }>) {
      questionCounts.set(q.survey_id, (questionCounts.get(q.survey_id) ?? 0) + 1);
    }
    const { data: rs } = await supabase
      .from("survey_responses")
      .select("survey_id")
      .in("survey_id", ids);
    for (const r of (rs ?? []) as Array<{ survey_id: string }>) {
      responseCounts.set(r.survey_id, (responseCounts.get(r.survey_id) ?? 0) + 1);
    }
  }

  // Banner uses the full-scope rows so a pinned district doesn't make
  // it lie about other districts; the rendered sections use rows
  // narrowed to the pinned district when one is set.
  const visibleRows = displayIds ? rows.filter((r) => displayIds.has(r.district_id)) : rows;
  const active = visibleRows.filter((r) => r.status === "active");
  const drafts = visibleRows.filter((r) => r.status === "draft");
  const paused = visibleRows.filter((r) => r.status === "paused");
  const archived = visibleRows.filter((r) => r.status === "archived");

  // Districts in the active client that have no live ('active') survey.
  // Surfacing this here means an admin doesn't have to discover the
  // problem from a "no survey live yet" report at the door — the
  // resolver in /app/household/[id] needs status='active' (or a
  // walkbook attachment) and an archived-only district silently breaks
  // canvassing.
  const allActiveDistrictIds = new Set(
    rows.filter((r) => r.status === "active").map((r) => r.district_id),
  );
  const districtsWithoutActive = districtOptions.filter((d) => !allActiveDistrictIds.has(d.id));
  const reusableByDistrict = new Map<string, typeof rows>();
  for (const r of rows) {
    if (r.status === "active") continue;
    const list = reusableByDistrict.get(r.district_id) ?? [];
    list.push(r);
    reusableByDistrict.set(r.district_id, list);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-navy-900">Surveys</h1>
          <p className="text-sm text-muted-foreground">
            Author surveys here. Volunteers see active surveys at the door; responses mirror to
            Airtable every 2 minutes.
          </p>
        </div>
        <NewSurveyButton districts={districtOptions} defaultDistrictId={defaultDistrictId} />
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-white p-10 text-center text-sm text-muted-foreground">
          No surveys yet. Hit <strong>New survey</strong> to start from scratch or a template.
        </div>
      ) : null}

      {districtsWithoutActive.length > 0 ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-medium">
            {districtsWithoutActive.length === 1
              ? "1 district has no active survey."
              : `${districtsWithoutActive.length} districts have no active survey.`}
          </p>
          <p className="mt-1 text-xs">
            Volunteers in these districts hit a &quot;no survey live yet&quot; empty state at the
            door. Publish a draft, or unarchive an existing survey from its edit page.
          </p>
          <ul className="mt-3 space-y-1.5 text-xs">
            {districtsWithoutActive.map((d) => {
              const reusable = reusableByDistrict.get(d.id) ?? [];
              return (
                <li key={d.id} className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-medium text-amber-900">{d.name}</span>
                  {reusable.length > 0 ? (
                    <span className="text-amber-800">
                      {reusable.length} non-active survey{reusable.length === 1 ? "" : "s"}:
                      {" "}
                      {reusable.slice(0, 3).map((r, i) => (
                        <span key={r.id}>
                          {i > 0 ? ", " : ""}
                          <Link
                            href={`/admin/surveys/${r.id}/edit`}
                            className="underline hover:text-amber-700"
                          >
                            {r.name} ({r.status})
                          </Link>
                        </span>
                      ))}
                      {reusable.length > 3 ? ` +${reusable.length - 3} more` : ""}
                    </span>
                  ) : (
                    <span className="text-amber-800">no surveys yet — create one</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {active.length > 0 ? (
        <Section title="Active" rows={active} qCounts={questionCounts} rCounts={responseCounts} />
      ) : null}
      {drafts.length > 0 ? (
        <Section title="Drafts" rows={drafts} qCounts={questionCounts} rCounts={responseCounts} />
      ) : null}
      {paused.length > 0 ? (
        <Section title="Paused" rows={paused} qCounts={questionCounts} rCounts={responseCounts} />
      ) : null}
      {archived.length > 0 ? (
        <Section
          title="Archived"
          rows={archived}
          qCounts={questionCounts}
          rCounts={responseCounts}
          muted
        />
      ) : null}
    </div>
  );
}

function Section({
  title,
  rows,
  qCounts,
  rCounts,
  muted,
}: {
  title: string;
  rows: Array<{
    id: string;
    name: string;
    description: string | null;
    priority: number;
    status: "draft" | "active" | "paused" | "archived";
    current_version: number;
    published_at: string | null;
    updated_at: string;
    visibility: string;
  }>;
  qCounts: Map<string, number>;
  rCounts: Map<string, number>;
  muted?: boolean;
}) {
  return (
    <section className={muted ? "opacity-70" : ""}>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-navy-500">
        {title} ({rows.length})
      </h2>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((s) => (
          <Link
            key={s.id}
            href={`/admin/surveys/${s.id}/edit`}
            className="group block rounded-lg border border-border bg-white p-4 transition hover:border-navy-300 hover:shadow-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-navy-900 group-hover:text-navy-700">
                  {s.name}
                </p>
                {s.description ? (
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{s.description}</p>
                ) : null}
              </div>
              <StatusBadge status={s.status} />
            </div>
            <div className="mt-3 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
              <span>v{s.current_version}</span>
              <span>{qCounts.get(s.id) ?? 0} questions</span>
              <span>{rCounts.get(s.id) ?? 0} responses</span>
              <span>priority {s.priority}</span>
              <span className="capitalize">{s.visibility.replace("_", " ")}</span>
            </div>
            <div className="mt-2 text-[11px] text-muted-foreground">
              {s.published_at
                ? `Published ${formatRelative(s.published_at)}`
                : `Updated ${formatRelative(s.updated_at)}`}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function StatusBadge({ status }: { status: "draft" | "active" | "paused" | "archived" }) {
  if (status === "active") return <Badge variant="success">Active</Badge>;
  if (status === "paused") return <Badge variant="warning">Paused</Badge>;
  if (status === "archived") return <Badge variant="secondary">Archived</Badge>;
  return <Badge variant="secondary">Draft</Badge>;
}
