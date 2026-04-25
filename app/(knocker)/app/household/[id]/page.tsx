import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { Household, KnockEvent, Tag, Voter } from "@/lib/types";
import { HouseholdDetail } from "@/components/knocker/household-detail";
import { householdKey } from "@/lib/addresses/normalize";
import { resolveAvailableSurveys } from "@/lib/surveys/resolve-available";

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
  //
  // The walkbook_surveys table + chosen_survey_id / chosen_script_id
  // columns on knock_sessions ship in migration 20260419000005. We treat
  // every query here as best-effort so a missing migration degrades to
  // the district default instead of 500'ing the page.
  type OpenSession = {
    walkbook_id: string | null;
    chosen_survey_id: string | null;
    chosen_script_id: string | null;
  };
  let open: OpenSession | null = null;
  try {
    const { data: openSession, error: sessErr } = await supabase
      .from("knock_sessions")
      .select("walkbook_id, chosen_survey_id, chosen_script_id")
      .eq("user_id", session.user.id)
      .is("ended_at", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (sessErr) {
      console.warn("household: knock_sessions lookup failed, falling back:", sessErr.message);
    } else {
      open = (openSession as OpenSession | null) ?? null;
    }
  } catch (err) {
    console.warn("household: knock_sessions query threw:", (err as Error).message);
  }

  // Resolver returns the *list* of surveys the volunteer can run at
  // this door. Household-detail decides what to do with the list:
  //   - 0 surveys → save with notes/tags/voice-note, no runner.
  //   - 1 survey  → auto-launch when the volunteer picks Home.
  //   - 2+        → render a picker so the volunteer chooses.
  // Resolution chain lives in lib/surveys/resolve-available.ts.
  const availableSurveys = await resolveAvailableSurveys(supabase, {
    districtId: hh.district_id,
    chosenSurveyId: open?.chosen_survey_id ?? null,
    walkbookId: open?.walkbook_id ?? null,
  });

  const [{ data: voters }, { data: recentKnocks }, { data: standardTags }] = await Promise.all([
    supabase
      .from("voters")
      .select("*")
      .in("household_id", householdIds)
      .order("last_name", { ascending: true }),
    // Multi-knocker era: pull the full recent history with knocker
    // + survey names so the volunteer at the door can see exactly
    // who's been here, what they recorded, and under what survey.
    supabase
      .from("knock_events")
      .select("*, users:user_id(full_name, email), surveys:survey_id(name)")
      .in("household_id", householdIds)
      .order("knocked_at", { ascending: false })
      .limit(25),
    supabase
      .from("tags")
      .select("*")
      .eq("district_id", hh.district_id)
      .eq("is_standard", true)
      .order("label"),
  ]);

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
          recentKnocks={((recentKnocks ?? []) as Array<
            KnockEvent & {
              users:
                | { full_name: string | null; email: string }
                | Array<{ full_name: string | null; email: string }>
                | null;
              surveys: { name: string } | Array<{ name: string }> | null;
            }
          >).map((k) => {
            const u = Array.isArray(k.users) ? k.users[0] : k.users;
            const s = Array.isArray(k.surveys) ? k.surveys[0] : k.surveys;
            return {
              ...k,
              knocker_name: u?.full_name ?? u?.email ?? null,
              survey_name: s?.name ?? null,
            };
          })}
          availableSurveys={availableSurveys}
          standardTags={(standardTags ?? []) as Tag[]}
          sessionScriptId={open?.chosen_script_id ?? null}
          hasVoiceNoteConsent={Boolean(session.user.voice_note_consent)}
        />
      </div>
    </div>
  );
}
