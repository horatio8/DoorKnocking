import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Household, KnockEvent, Survey, SurveyQuestion, Tag, Voter } from "@/lib/types";
import { HouseholdDetail } from "@/components/knocker/household-detail";
import { householdKey } from "@/lib/addresses/normalize";

export const dynamic = "force-dynamic";

export default async function HouseholdPage({ params }: { params: { id: string } }) {
  const session = await loadSession();
  if (!session) redirect("/login");

  const supabase = getSupabaseServerClient();
  const { data: household } = await supabase
    .from("households")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();
  if (!household) notFound();
  const hh = household as Household;

  // Some imports create multiple household rows for the same physical address
  // (different capitalisation, or the fallback key didn't normalise quite
  // aggressively enough). Aggregate voters from every household in this
  // district whose normalized (address, unit, zip) key matches — so a knock
  // on "1215 Apex Ln" shows every resident registered there, not just the
  // row the map pin happened to hit.
  //
  // This explicitly does NOT merge apartments: rows with distinct unit
  // values produce distinct keys, so Apt 1 and Apt 2 stay separate.
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

  const [{ data: voters }, { data: recentKnocks }, { data: surveys }, { data: standardTags }] =
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
      supabase
        .from("surveys")
        .select("*, survey_questions(*)")
        .eq("district_id", hh.district_id)
        .eq("active", true)
        .order("priority", { ascending: false }),
      supabase
        .from("tags")
        .select("*")
        .eq("district_id", hh.district_id)
        .eq("is_standard", true)
        .order("label"),
    ]);

  const activeSurvey = surveys?.[0] as (Survey & { survey_questions: SurveyQuestion[] }) | undefined;

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
          survey={activeSurvey ?? null}
          standardTags={(standardTags ?? []) as Tag[]}
        />
      </div>
    </div>
  );
}
