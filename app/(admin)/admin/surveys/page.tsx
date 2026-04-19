import Link from "next/link";
import { redirect } from "next/navigation";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { getActiveClient } from "@/lib/clients/active";
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
  const districtOptions = (districts ?? []) as Array<{ id: string; name: string }>;
  const districtIds = districtOptions.map((d) => d.id);
  const defaultDistrictId = session.district?.id ?? districtOptions[0]?.id ?? null;

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

  const active = rows.filter((r) => r.status === "active");
  const drafts = rows.filter((r) => r.status === "draft");
  const paused = rows.filter((r) => r.status === "paused");
  const archived = rows.filter((r) => r.status === "archived");

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
