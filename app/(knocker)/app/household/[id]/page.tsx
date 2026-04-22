import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { Household, KnockEvent, Survey, SurveyQuestion, Tag, Voter } from "@/lib/types";
import { HouseholdDetail } from "@/components/knocker/household-detail";
import { householdKey } from "@/lib/addresses/normalize";

export const dynamic = "force-dynamic";

export default async function HouseholdPage({ params }: { params: { id: string } }) {
  const session = await loadSession();
  if (!session) redirect("/login");

  const supabase = getSupabaseServiceRoleClient();
  const { data: household } = await supabase
    .from("households")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();
  if (!household) notFound();
  const hh = household as Household;

  // Cross-row voter aggregation for same-address records (apartments
  // preserved via the unit segment in the key).
  const targetKey = householdKey({
    address: hh.address_line1,
    unit: hh.unit,
    zip: hh.zip,
  });
  const { data: peerRows } = await supabase
    .from("households")
    .select("id, address_line1, unit, zip")
    .eq("district_id", hh.district_id);
  const peers = ((peerRows ?? []) as Array<{
    id: string;
    address_line1: string | null;
    unit: string | null;
    zip: string | null;
  }>).filter(
    (r) => householdKey({ address: r.address_line1, unit: r.unit, zip: r.zip }) === targetKey,
  );
  const householdIds = peers.map((p) => p.id);
  const mergedCount = Math.max(0, householdIds.length - 1);

  // Survey resolution precedence (C4):
  //   1. The walkbook-level attachment for the volunteer's active session's
  //      walkbook (if they have an open session AND it has chosen_survey_id)
  //   2. Any walkbook_surveys attachment on that walkbook (pinned wins, else
  //      highest priority)
  //   3. The district's active default survey (status='active')
  //   4. null → graceful "no survey" state
  const { data: openSession } = await supabase
    .from("knock_sessions")
    .select("walkbook_id, chosen_survey_id, chosen_script_id")
    .eq("user_id", session.user.id)
    .is("ended_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const open = openSession as {
    walkbook_id: string | null;
    chosen_survey_id: string | null;
    chosen_script_id: string | null;
  } | null;

  let resolvedSurveyId: string | null = open?.chosen_survey_id ?? null;

  if (!resolvedSurveyId && open?.walkbook_id) {
    const { data: wbSurveys } = await supabase
      .from("walkbook_surveys")
      .select("survey_id, pinned, priority")
      .eq("walkbook_id", open.walkbook_id)
      .order("pinned", { ascending: false })
      .order("priority", { ascending: false })
      .limit(1);
    resolvedSurveyId = ((wbSurveys ?? []) as Array<{ survey_id: string }>)[0]?.survey_id ?? null;
  }

  if (!resolvedSurveyId) {
    const { data: districtActive } = await supabase
      .from("surveys")
      .select("id")
      .eq("district_id", hh.district_id)
      .eq("status", "active")
      .order("priority", { ascending: false })
      .limit(1);
    resolvedSurveyId = ((districtActive ?? []) as Array<{ id: string }>)[0]?.id ?? null;
  }

  const [{ data: voters }, { data: recentKnocks }, { data: surveyRow }, { data: standardTags }] =
    await Promise.all([
      supabase
        .from("voters")
        .select("*")
        .in("household_id", householdIds)
        .order("last_name", { ascending: true }),
      supabase
        .from("knock_events")
        .select("*")
        .in("household_id", householdIds)
        .order("knocked_at", { ascending: false })
        .limit(10),
      resolvedSurveyId
        ? supabase
            .from("surveys")
            .select("*, survey_questions(*)")
            .eq("id", resolvedSurveyId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from("tags")
        .select("*")
        .eq("district_id", hh.district_id)
        .eq("is_standard", true)
        .order("label"),
    ]);

  const activeSurvey = (surveyRow ?? null) as
    | (Survey & { survey_questions: SurveyQuestion[] })
    | null;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center gap-3 border-b border-border bg-white px-4 py-3">
        <Link href="/app/map" className="text-navy-700 hover:text-navy">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            Household
            {hh.unit ? ` · Unit ${hh.unit}` : ""}
            {mergedCount > 0 ? ` · ${mergedCount + 1} records merged` : ""}
          </p>
          <p className="truncate font-serif text-base font-semibold text-navy-900">
            {hh.address_line1}
          </p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <HouseholdDetail
          userId={session.user.id}
          household={hh}
          voters={(voters ?? []) as Voter[]}
          recentKnocks={(recentKnocks ?? []) as KnockEvent[]}
          survey={activeSurvey}
          standardTags={(standardTags ?? []) as Tag[]}
          sessionScriptId={open?.chosen_script_id ?? null}
          hasVoiceNoteConsent={Boolean(session.user.voice_note_consent)}
        />
      </div>
    </div>
  );
}
