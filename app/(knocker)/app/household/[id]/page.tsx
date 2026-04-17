import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Household, KnockEvent, Survey, SurveyQuestion, Tag, Voter } from "@/lib/types";
import { HouseholdDetail } from "@/components/knocker/household-detail";

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

  const [{ data: voters }, { data: recentKnocks }, { data: surveys }, { data: standardTags }] =
    await Promise.all([
      supabase
        .from("voters")
        .select("*")
        .eq("household_id", params.id)
        .order("last_name", { ascending: true }),
      supabase
        .from("knock_events")
        .select("*")
        .eq("household_id", params.id)
        .order("knocked_at", { ascending: false })
        .limit(10),
      supabase
        .from("surveys")
        .select("*, survey_questions(*)")
        .eq("district_id", (household as Household).district_id)
        .eq("active", true)
        .order("priority", { ascending: false }),
      supabase
        .from("tags")
        .select("*")
        .eq("district_id", (household as Household).district_id)
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
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Household</p>
          <p className="font-serif text-base font-semibold text-navy-900">
            {(household as Household).address_line1}
          </p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <HouseholdDetail
          userId={session.user.id}
          household={household as Household}
          voters={(voters ?? []) as Voter[]}
          recentKnocks={(recentKnocks ?? []) as KnockEvent[]}
          survey={activeSurvey ?? null}
          standardTags={(standardTags ?? []) as Tag[]}
        />
      </div>
    </div>
  );
}
