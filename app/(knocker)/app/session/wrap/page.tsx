import { redirect } from "next/navigation";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { SessionWrap } from "@/components/knocker/session-wrap";

export const dynamic = "force-dynamic";

export default async function SessionWrapPage({
  searchParams,
}: {
  searchParams: { id?: string };
}) {
  const session = await loadSession();
  if (!session) redirect("/login");

  const supabase = getSupabaseServiceRoleClient();

  // If a specific session was passed, prefer that; otherwise find the most
  // recent one (open or closed) so we can show stats even after end().
  let query = supabase
    .from("knock_sessions")
    .select("id, walkbook_id, started_at, ended_at, knock_count, duration_seconds, pace_multiplier, walking_coherence_score")
    .eq("user_id", session.user.id)
    .order("started_at", { ascending: false })
    .limit(1);
  if (searchParams.id) {
    query = supabase
      .from("knock_sessions")
      .select("id, walkbook_id, started_at, ended_at, knock_count, duration_seconds, pace_multiplier, walking_coherence_score")
      .eq("id", searchParams.id)
      .eq("user_id", session.user.id)
      .limit(1);
  }
  const { data } = await query.maybeSingle();
  const sessRow = data as
    | {
        id: string;
        walkbook_id: string | null;
        started_at: string;
        ended_at: string | null;
        knock_count: number;
        duration_seconds: number | null;
        pace_multiplier: number;
        walking_coherence_score: number | null;
      }
    | null;
  if (!sessRow) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        No knock sessions yet. Head to the walkbooks tab and pick one to get started.
      </div>
    );
  }

  // Per-event stats for this session's duration window.
  const { data: events } = await supabase
    .from("knock_events")
    .select("status, survey_completed")
    .eq("user_id", session.user.id)
    .gte("knocked_at", sessRow.started_at)
    .lte("knocked_at", sessRow.ended_at ?? new Date().toISOString());
  const rows = (events ?? []) as Array<{ status: string; survey_completed: boolean }>;
  const doors = rows.length;
  const contacts = rows.filter((e) => e.status === "contacted").length;
  const surveys = rows.filter((e) => e.survey_completed).length;

  let walkbookName: string | null = null;
  if (sessRow.walkbook_id) {
    const { data: wb } = await supabase
      .from("walkbooks")
      .select("name")
      .eq("id", sessRow.walkbook_id)
      .maybeSingle();
    walkbookName = (wb as { name: string } | null)?.name ?? null;
  }

  return (
    <SessionWrap
      sessionId={sessRow.id}
      walkbookId={sessRow.walkbook_id}
      walkbookName={walkbookName}
      startedAt={sessRow.started_at}
      endedAt={sessRow.ended_at}
      durationSeconds={sessRow.duration_seconds}
      doors={doors}
      contacts={contacts}
      surveys={surveys}
      paceMultiplier={Number(sessRow.pace_multiplier ?? 1)}
    />
  );
}
