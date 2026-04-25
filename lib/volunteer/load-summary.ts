import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";

export type OutcomeKey = "supportive" | "undecided" | "not_supportive";

export interface SessionSummary {
  sessionId: string | null;
  startedAt: string | null;
  durationMins: number;
  walkbookName: string | null;
  doorsKnocked: number;
  contacts: number;
  supportive: number;
  undecided: number;
  notSupportive: number;
  refused: number;
  noAnswer: number;
  comeBackLater: number;
  commitments: Array<{
    id: string;
    addressLine1: string | null;
    promisedAt: string;
    bucket: string;
  }>;
}

const NEUTRAL: SessionSummary = {
  sessionId: null,
  startedAt: null,
  durationMins: 0,
  walkbookName: null,
  doorsKnocked: 0,
  contacts: 0,
  supportive: 0,
  undecided: 0,
  notSupportive: 0,
  refused: 0,
  noAnswer: 0,
  comeBackLater: 0,
  commitments: [],
};

export async function loadSessionSummary(userId: string): Promise<SessionSummary> {
  const supabase = getSupabaseServiceRoleClient();

  // Find the most recent session — open or closed — so the wrap-up screen
  // works whether the volunteer just tapped "wrap up" or already ended it.
  const { data: latest } = await supabase
    .from("knock_sessions")
    .select("id, walkbook_id, started_at, ended_at")
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sessionRow = latest as {
    id: string;
    walkbook_id: string | null;
    started_at: string;
    ended_at: string | null;
  } | null;
  if (!sessionRow) return NEUTRAL;

  const startedAt = sessionRow.started_at;
  const endedAt = sessionRow.ended_at ? new Date(sessionRow.ended_at).getTime() : Date.now();
  const durationMins = Math.max(
    0,
    Math.round((endedAt - new Date(startedAt).getTime()) / 60_000),
  );

  const { data: events } = await supabase
    .from("knock_events")
    .select("status, notes, household_id")
    .eq("user_id", userId)
    .gte("knocked_at", startedAt);
  const evRows = (events ?? []) as Array<{
    status: string;
    notes: string | null;
    household_id: string;
  }>;

  let supportive = 0;
  let undecided = 0;
  let notSupportive = 0;
  let refused = 0;
  let noAnswer = 0;
  let comeBackLater = 0;
  const doors = new Set<string>();

  for (const ev of evRows) {
    doors.add(ev.household_id);
    switch (ev.status) {
      case "contacted":
        if (ev.notes?.includes("supportive") && !ev.notes.includes("not_supportive")) supportive += 1;
        else if (ev.notes?.includes("undecided")) undecided += 1;
        else if (ev.notes?.includes("not_supportive")) notSupportive += 1;
        else supportive += 1;
        break;
      case "refused":
        refused += 1;
        break;
      case "no_answer":
        noAnswer += 1;
        break;
      case "come_back_later":
        comeBackLater += 1;
        break;
      default:
        break;
    }
  }

  let walkbookName: string | null = null;
  if (sessionRow.walkbook_id) {
    const { data: wb } = await supabase
      .from("walkbooks")
      .select("name")
      .eq("id", sessionRow.walkbook_id)
      .maybeSingle();
    walkbookName = (wb as { name?: string } | null)?.name ?? null;
  }

  // Commitments — tolerant of the table not existing (pre-migration).
  let commitments: SessionSummary["commitments"] = [];
  try {
    const { data: commits } = await supabase
      .from("household_commitments")
      .select("id, household_id, promised_at, bucket")
      .eq("user_id", userId)
      .gte("created_at", startedAt)
      .order("promised_at", { ascending: true });
    const commitRows = (commits ?? []) as Array<{
      id: string;
      household_id: string;
      promised_at: string;
      bucket: string;
    }>;
    if (commitRows.length > 0) {
      const ids = commitRows.map((c) => c.household_id);
      const { data: hhs } = await supabase
        .from("households")
        .select("id, address_line1")
        .in("id", ids);
      const addrById = new Map<string, string>();
      for (const h of (hhs ?? []) as Array<{ id: string; address_line1: string | null }>) {
        addrById.set(h.id, h.address_line1 ?? "");
      }
      commitments = commitRows.map((c) => ({
        id: c.id,
        addressLine1: addrById.get(c.household_id) ?? null,
        promisedAt: c.promised_at,
        bucket: c.bucket,
      }));
    }
  } catch {
    // ignore — table may not exist on this DB yet.
  }

  return {
    sessionId: sessionRow.id,
    startedAt,
    durationMins,
    walkbookName,
    doorsKnocked: doors.size,
    contacts: supportive + undecided + notSupportive,
    supportive,
    undecided,
    notSupportive,
    refused,
    noAnswer,
    comeBackLater,
    commitments,
  };
}
