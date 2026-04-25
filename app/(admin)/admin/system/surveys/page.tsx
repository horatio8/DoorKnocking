import { redirect } from "next/navigation";
import Link from "next/link";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { listScopedDistricts } from "@/lib/districts/active";
import { resolveAvailableSurveys } from "@/lib/surveys/resolve-available";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

// /admin/system/surveys — Survey Health
//
// One page that answers the question "would a volunteer at a door
// in this district see a survey right now, and if not, why not?".
// Mirrors the resolver from lib/surveys/resolve-available.ts, runs
// it for every district in scope (active client + role-aware),
// reports the effective pick + a punch list of fixes per district.
//
// Uses the service role under the existing admin role gate (same
// pattern as /admin/airtable/diagnose).

interface SurveyRow {
  id: string;
  name: string;
  status: "draft" | "active" | "paused" | "archived";
  district_id: string;
  priority: number;
  current_version: number;
  updated_at: string;
}

export default async function SurveyHealthPage() {
  const session = await loadSession();
  if (!session) redirect("/login");
  if (session.user.role !== "admin" && session.user.role !== "super_admin") {
    redirect("/app");
  }
  const supabase = getSupabaseServiceRoleClient();
  const districts = await listScopedDistricts();
  if (districts.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-white p-6 text-center text-sm text-muted-foreground">
        No districts in scope. Pick an active client up top, or have a
        super_admin grant district access.
      </div>
    );
  }

  // Pull every survey + question count for the scoped districts in
  // one shot, then run the resolver per-district. Two queries beats
  // N+1 and keeps the page fast for clients with many districts.
  const districtIds = districts.map((d) => d.id);
  const [surveysRes, questionCountsRes] = await Promise.all([
    supabase
      .from("surveys")
      .select(
        "id, name, status, district_id, priority, current_version, updated_at",
      )
      .in("district_id", districtIds),
    supabase
      .from("survey_questions")
      .select("survey_id"),
  ]);
  const surveys = (surveysRes.data ?? []) as SurveyRow[];
  const questionCount = new Map<string, number>();
  for (const q of (questionCountsRes.data ?? []) as Array<{ survey_id: string }>) {
    questionCount.set(q.survey_id, (questionCount.get(q.survey_id) ?? 0) + 1);
  }

  // Run the actual resolver per district so the page reports what
  // the door would actually see, not a guess.
  const reports = await Promise.all(
    districts.map(async (d) => {
      const districtSurveys = surveys.filter((s) => s.district_id === d.id);
      const counts = {
        active: districtSurveys.filter((s) => s.status === "active").length,
        draft: districtSurveys.filter((s) => s.status === "draft").length,
        paused: districtSurveys.filter((s) => s.status === "paused").length,
        archived: districtSurveys.filter((s) => s.status === "archived").length,
        total: districtSurveys.length,
      };
      const resolved = await resolveAvailableSurveys(supabase, {
        districtId: d.id,
        chosenSurveyId: null,
        walkbookId: null,
      });
      const issues: string[] = [];
      if (resolved.length === 0) {
        if (counts.total === 0) {
          issues.push(
            "no surveys created — go to /admin/surveys and click New survey.",
          );
        } else if (counts.active === 0 && counts.draft === 0) {
          issues.push(
            "every survey is paused or archived — open one in /admin/surveys, unarchive, then publish.",
          );
        } else {
          // Find the first draft/active that's empty so we can name it.
          const empty = districtSurveys.find(
            (s) =>
              (s.status === "active" || s.status === "draft") &&
              (questionCount.get(s.id) ?? 0) === 0,
          );
          if (empty) {
            issues.push(
              `"${empty.name}" has 0 questions — open it and add at least one before publishing.`,
            );
          } else {
            issues.push(
              "no usable survey resolved — reach out for help; check Vercel logs for [survey:resolver] entries.",
            );
          }
        }
      }
      const effective = resolved[0] ?? null;
      if (effective && effective.status !== "active") {
        issues.push(
          `volunteers will currently see "${effective.name}" (${effective.status}). Publish for the official version.`,
        );
      }
      return {
        district: d,
        counts,
        surveys: districtSurveys
          .map((s) => ({
            ...s,
            question_count: questionCount.get(s.id) ?? 0,
          }))
          .sort(
            (a, b) =>
              statusRank(a.status) - statusRank(b.status) ||
              b.priority - a.priority ||
              b.updated_at.localeCompare(a.updated_at),
          ),
        resolved: resolved.map((s) => ({
          id: s.id,
          name: s.name,
          status: s.status,
          question_count: s.survey_questions.length,
        })),
        issues,
      };
    }),
  );

  const totalIssues = reports.reduce((n, r) => n + r.issues.length, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-navy-900">
            Survey health
          </h1>
          <p className="text-sm text-muted-foreground">
            For every district in scope, runs the same resolver the volunteer&rsquo;s door
            uses and reports what would happen right now. Healthy districts show one
            or more &ldquo;Resolved&rdquo; surveys; broken ones show a punch list.
          </p>
        </div>
        <Link
          href="/api/admin/surveys/diagnose"
          target="_blank"
          rel="noreferrer"
          className="text-xs text-muted-foreground underline"
        >
          Raw JSON
        </Link>
      </div>

      {totalIssues > 0 ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-medium">{totalIssues} issue{totalIssues === 1 ? "" : "s"} across {reports.length} district{reports.length === 1 ? "" : "s"}.</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
            {reports.flatMap((r) =>
              r.issues.map((i, idx) => (
                <li key={`${r.district.id}-${idx}`}>
                  <span className="font-medium">{r.district.name}:</span> {i}
                </li>
              )),
            )}
          </ul>
        </div>
      ) : (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          No survey issues across {reports.length} district{reports.length === 1 ? "" : "s"} in scope.
        </p>
      )}

      <div className="space-y-5">
        {reports.map((r) => (
          <section key={r.district.id} className="rounded-lg border border-border bg-white p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-serif text-lg font-semibold text-navy-900">
                {r.district.name}
              </h2>
              <p className="text-xs text-muted-foreground">
                {r.counts.total} survey{r.counts.total === 1 ? "" : "s"} ·
                {" "}
                {r.counts.active} active · {r.counts.draft} draft · {r.counts.paused} paused ·
                {" "}
                {r.counts.archived} archived
              </p>
            </div>

            <div className="mt-3">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-navy-500">
                Resolver pick (what the door will load)
              </p>
              {r.resolved.length === 0 ? (
                <p className="mt-1 rounded border border-dashed border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
                  Nothing — volunteers see &ldquo;no survey live yet&rdquo;.
                </p>
              ) : (
                <ul className="mt-1 space-y-1 text-xs">
                  {r.resolved.map((s, i) => (
                    <li
                      key={s.id}
                      className="flex flex-wrap items-center gap-2 rounded border border-navy-100 bg-navy-50/40 px-2 py-1"
                    >
                      <span className="font-mono text-[10px] text-navy-500">
                        {i === 0 ? "PICK" : `${i + 1}.`}
                      </span>
                      <span className="font-medium text-navy-900">{s.name}</span>
                      <StatusBadge status={s.status} />
                      <span className="text-muted-foreground">{s.question_count} questions</span>
                      <Link
                        href={`/admin/surveys/${s.id}/edit`}
                        className="ml-auto text-[11px] text-navy-700 underline"
                      >
                        Edit
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {r.surveys.length > 0 ? (
              <div className="mt-4">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-navy-500">
                  All surveys
                </p>
                <table className="mt-1 w-full text-xs">
                  <thead>
                    <tr className="text-left text-[10px] uppercase tracking-widest text-navy-500">
                      <th className="py-1">Name</th>
                      <th className="py-1">Status</th>
                      <th className="py-1">Questions</th>
                      <th className="py-1">v</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.surveys.map((s) => (
                      <tr key={s.id} className="border-t border-border/70">
                        <td className="py-1.5">{s.name}</td>
                        <td className="py-1.5">
                          <StatusBadge status={s.status} />
                        </td>
                        <td className="py-1.5">
                          <span
                            className={
                              s.question_count === 0
                                ? "text-crimson"
                                : "text-muted-foreground"
                            }
                          >
                            {s.question_count}
                          </span>
                        </td>
                        <td className="py-1.5 text-muted-foreground">v{s.current_version}</td>
                        <td className="py-1.5 text-right">
                          <Link
                            href={`/admin/surveys/${s.id}/edit`}
                            className="text-navy-700 underline"
                          >
                            Open
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            {r.issues.length > 0 ? (
              <div className="mt-3 rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                <p className="font-medium">Punch list</p>
                <ul className="ml-4 list-disc">
                  {r.issues.map((i, idx) => (
                    <li key={idx}>{i}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        ))}
      </div>
    </div>
  );
}

function statusRank(status: string): number {
  switch (status) {
    case "active":
      return 0;
    case "draft":
      return 1;
    case "paused":
      return 2;
    case "archived":
      return 3;
    default:
      return 4;
  }
}

function StatusBadge({ status }: { status: string }) {
  if (status === "active") return <Badge variant="success">Active</Badge>;
  if (status === "paused") return <Badge variant="warning">Paused</Badge>;
  if (status === "archived") return <Badge variant="secondary">Archived</Badge>;
  return <Badge variant="secondary">Draft</Badge>;
}
