import { redirect, notFound } from "next/navigation";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { PreviewWalkbook } from "@/components/knocker/preview-walkbook";

export const dynamic = "force-dynamic";

export default async function WalkbookPreviewPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await loadSession();
  if (!session) redirect("/login");

  const supabase = getSupabaseServiceRoleClient();
  const { data: wb } = await supabase
    .from("walkbooks")
    .select(
      "id, name, description, district_id, household_count, estimated_duration_minutes, target_duration_minutes, centroid_lat, centroid_lng, bounding_box, kind",
    )
    .eq("id", params.id)
    .maybeSingle();
  if (!wb) notFound();
  const walkbook = wb as {
    id: string;
    name: string;
    description: string | null;
    district_id: string;
    household_count: number;
    estimated_duration_minutes: number | null;
    target_duration_minutes: number | null;
    centroid_lat: number | null;
    centroid_lng: number | null;
  };

  // Survey choices the volunteer picks from before starting the
  // session. Mirrors lib/surveys/resolve-available.ts so the preview
  // page never offers anything the door resolver wouldn't accept:
  //   - walkbook_surveys attachments (any non-archived status), then
  //   - district status='active', then
  //   - district status='draft' as a fallback so admins can iterate
  //     without re-publishing every change.
  const [walkbookSurveysRes, districtSurveysRes, draftSurveysRes] = await Promise.all([
    supabase
      .from("walkbook_surveys")
      .select(
        "survey_id, pinned, priority, surveys(id, name, status, current_version)",
      )
      .eq("walkbook_id", walkbook.id)
      .order("priority", { ascending: false }),
    supabase
      .from("surveys")
      .select("id, name, status")
      .eq("district_id", walkbook.district_id)
      .eq("status", "active")
      .order("priority", { ascending: false }),
    supabase
      .from("surveys")
      .select("id, name, status")
      .eq("district_id", walkbook.district_id)
      .eq("status", "draft")
      .order("updated_at", { ascending: false }),
  ]);

  type SurveyChoice = {
    id: string;
    name: string;
    pinned: boolean;
    source: "walkbook" | "district";
  };

  const surveyChoices: SurveyChoice[] = (
    (walkbookSurveysRes.data ?? []) as Array<{
      pinned: boolean;
      surveys:
        | { id: string; name: string; status: string }
        | Array<{ id: string; name: string; status: string }>
        | null;
    }>
  ).flatMap((r) => {
    const s = Array.isArray(r.surveys) ? r.surveys[0] : r.surveys;
    if (!s || s.status === "archived") return [];
    return [{ id: s.id, name: s.name, pinned: r.pinned, source: "walkbook" as const }];
  });

  // No walkbook attachments → fall through to active, then drafts.
  if (surveyChoices.length === 0) {
    const fallbackList = ((districtSurveysRes.data ?? []) as Array<{
      id: string;
      name: string;
      status: string;
    }>).concat(
      (draftSurveysRes.data ?? []) as Array<{
        id: string;
        name: string;
        status: string;
      }>,
    );
    for (const s of fallbackList) {
      surveyChoices.push({
        id: s.id,
        name: s.name,
        pinned: false,
        source: "district",
      });
    }
  }
  console.info("[survey:walkbook-preview] surveyChoices", {
    walkbookId: walkbook.id,
    districtId: walkbook.district_id,
    choices: surveyChoices.length,
    sources: surveyChoices.map((c) => `${c.source}:${c.id}`),
  });

  return (
    <PreviewWalkbook
      walkbook={{
        id: walkbook.id,
        name: walkbook.name,
        description: walkbook.description ?? "",
        household_count: walkbook.household_count,
        estimated_duration_minutes: walkbook.estimated_duration_minutes,
        centroid: {
          lat: walkbook.centroid_lat,
          lng: walkbook.centroid_lng,
        },
      }}
      surveyChoices={surveyChoices}
    />
  );
}
