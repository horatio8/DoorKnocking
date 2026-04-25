import { NextResponse } from "next/server";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { listScopedDistricts } from "@/lib/districts/active";

// GET /api/admin/surveys/diagnose
//   ?district_id=<uuid>  scope to one district
//   (no district_id)     scope to every district visible under the
//                        admin's active client / district_access
//
// Read-only summary that answers "why aren't volunteers seeing a
// survey?" without making the caller hand-write SQL. For each
// district in scope, returns:
//   - status counts (active / draft / paused / archived)
//   - per-survey question count, plus a publishability check
//     mirroring /api/admin/surveys/[id]/publish (key presence,
//     duplicate keys, choice-needs-options) so we know exactly which
//     drafts could be activated and which can't.
//   - the resolver's effective pick (active highest priority, or
//     newest draft with questions if no active exists).
// Plus an issues[] array of short strings the caller can render
// directly so the admin sees a punch list, not raw rows.

export const dynamic = "force-dynamic";

interface SurveyRow {
  id: string;
  name: string;
  district_id: string;
  status: string;
  priority: number;
  current_version: number;
  updated_at: string;
}

interface QuestionRow {
  survey_id: string;
  id: string;
  question_text: string;
  question_type: string;
  question_key: string | null;
  options: unknown;
}

export async function GET(req: Request) {
  const session = await loadSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (session.user.role !== "admin" && session.user.role !== "super_admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const requestedDistrict = url.searchParams.get("district_id");

  const supabase = getSupabaseServiceRoleClient();
  const scoped = await listScopedDistricts();
  const districts = requestedDistrict
    ? scoped.filter((d) => d.id === requestedDistrict)
    : scoped;
  if (districts.length === 0) {
    return NextResponse.json({
      districts: [],
      issues: [
        requestedDistrict
          ? "district_id is outside your scope or doesn't exist"
          : "no districts in your scope — pick a client up top or get district access",
      ],
    });
  }

  const districtIds = districts.map((d) => d.id);
  const { data: surveyRows } = await supabase
    .from("surveys")
    .select("id, name, district_id, status, priority, current_version, updated_at")
    .in("district_id", districtIds);
  const surveys = (surveyRows ?? []) as SurveyRow[];

  let questions: QuestionRow[] = [];
  if (surveys.length > 0) {
    const ids = surveys.map((s) => s.id);
    const { data: qRows } = await supabase
      .from("survey_questions")
      .select("survey_id, id, question_text, question_type, question_key, options")
      .in("survey_id", ids);
    questions = (qRows ?? []) as QuestionRow[];
  }
  const questionsBySurvey = new Map<string, QuestionRow[]>();
  for (const q of questions) {
    const list = questionsBySurvey.get(q.survey_id) ?? [];
    list.push(q);
    questionsBySurvey.set(q.survey_id, list);
  }

  // Mirror the publish-route validation. If a draft passes this it
  // would publish cleanly; if not, the problems[] array tells the
  // admin what to fix.
  function publishabilityProblems(qs: QuestionRow[]): string[] {
    const problems: string[] = [];
    if (qs.length === 0) problems.push("needs at least one question");
    const seenKeys = new Set<string>();
    for (const q of qs) {
      const truncated = q.question_text?.slice(0, 32) ?? "(no text)";
      if (!q.question_key) {
        problems.push(`"${truncated}" is missing a question key`);
        continue;
      }
      if (seenKeys.has(q.question_key)) problems.push(`duplicate key "${q.question_key}"`);
      seenKeys.add(q.question_key);
      if (
        (q.question_type === "single_choice" || q.question_type === "multi_choice") &&
        (!Array.isArray(q.options) || (q.options as unknown[]).length === 0)
      ) {
        problems.push(`"${q.question_key}" needs options`);
      }
    }
    return problems;
  }

  const reportByDistrict = districts.map((d) => {
    const districtSurveys = surveys.filter((s) => s.district_id === d.id);
    const enriched = districtSurveys.map((s) => {
      const qs = questionsBySurvey.get(s.id) ?? [];
      const problems = publishabilityProblems(qs);
      return {
        id: s.id,
        name: s.name,
        status: s.status,
        priority: s.priority,
        current_version: s.current_version,
        updated_at: s.updated_at,
        question_count: qs.length,
        publishable: problems.length === 0,
        problems,
      };
    });
    enriched.sort((a, b) => b.priority - a.priority || b.updated_at.localeCompare(a.updated_at));
    const active = enriched.filter((s) => s.status === "active");
    const drafts = enriched.filter((s) => s.status === "draft");
    const paused = enriched.filter((s) => s.status === "paused");
    const archived = enriched.filter((s) => s.status === "archived");

    // Resolver-effective pick: matches the logic the household page
    // is about to use after the fallback change ships. Preview here
    // so the caller knows what the door will actually load.
    const effective =
      active[0] ??
      drafts.find((d) => d.question_count > 0) ??
      null;

    const issues: string[] = [];
    if (active.length === 0) {
      if (drafts.some((s) => s.publishable)) {
        const target = drafts.find((s) => s.publishable)!;
        issues.push(
          `no active survey — "${target.name}" is publish-ready (${target.question_count} questions, no validation problems). Open /admin/surveys/${target.id}/edit and click Publish.`,
        );
      } else if (drafts.length > 0) {
        const blocker = drafts[0]!;
        issues.push(
          `no active survey — "${blocker.name}" is the closest draft but blocked: ${blocker.problems.join("; ")}.`,
        );
      } else if (archived.length > 0) {
        const target = archived[0]!;
        issues.push(
          `no active survey, but "${target.name}" is archived. Open it in /admin/surveys, click Unarchive (move to draft), then Publish.`,
        );
      } else {
        issues.push("no surveys at all in this district — create one on /admin/surveys.");
      }
    }
    if (paused.length > 0 && active.length === 0) {
      const target = paused[0]!;
      issues.push(
        `"${target.name}" is paused. Move it back to draft and re-publish, or unpause it.`,
      );
    }
    if (effective && effective.status !== "active") {
      issues.push(
        `volunteers will currently see "${effective.name}" (status="${effective.status}") because no active survey exists. Publish it for the official version.`,
      );
    }

    return {
      district: { id: d.id, name: d.name, slug: d.slug },
      counts: {
        active: active.length,
        drafts: drafts.length,
        paused: paused.length,
        archived: archived.length,
      },
      effective_pick: effective
        ? {
            id: effective.id,
            name: effective.name,
            status: effective.status,
            question_count: effective.question_count,
          }
        : null,
      surveys: enriched,
      issues,
    };
  });

  // Aggregate: a single issues[] across all reported districts so a
  // caller can render a punch list without merging structures.
  const aggregated: string[] = [];
  for (const r of reportByDistrict) {
    for (const i of r.issues) aggregated.push(`${r.district.name}: ${i}`);
  }

  return NextResponse.json({
    districts: reportByDistrict,
    issues: aggregated,
  });
}
