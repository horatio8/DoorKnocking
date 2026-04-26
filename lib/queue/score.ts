// Runtime voter scorer.
//
// Combines the seven signals from VOTER_QUEUE brief § 2 into a single
// score per voter. Designed to run in one Supabase round-trip per
// district — pulls every unknocked voter + every knock event in the
// last 90 minutes + active commitments, then scores in-memory.
//
// Skipped vs spec until voter file gains the columns:
//   • Age adjustment in time_of_day — the voters table has no birth
//     date / age, so we use the district baseline only.
//   • Explicit priority flag (Priority/PersuasionTarget/GOTVTarget) —
//     ditto. Priority signal collapses to party-match.
//   • Turnout-history component — no turnout column on voters yet.
// These are additive refinements; the queue still produces a sensible
// ordering without them.

import type { SupabaseClient } from "@supabase/supabase-js";
import { defaultAtHomeRate } from "./baseline";

export interface ScoreWeights {
  time_of_day: number;
  priority: number;
  proximity: number;
  freshness: number;
  commitment: number;
  cluster: number;
  recent_attempt_penalty: number;
}

export const DEFAULT_WEIGHTS: ScoreWeights = {
  time_of_day: 0.25,
  priority: 0.2,
  proximity: 0.15,
  freshness: 0.15,
  commitment: 0.1,
  cluster: 0.1,
  recent_attempt_penalty: 0.05,
};

export interface ScoreContext {
  districtId: string;
  now: Date;
  gps: { lat: number; lng: number } | null;
  targetParty: string | null; // e.g. "Republican" for the campaign
  weights?: Partial<ScoreWeights>;
}

export interface ScoredVoter {
  voterId: string;
  householdId: string;
  lat: number;
  lng: number;
  displayName: string;
  party: string | null;
  score: number;
  signals: {
    time_of_day: number;
    priority: number;
    proximity: number;
    freshness: number;
    commitment: number;
    cluster: number;
    recent_attempt: number;
  };
}

interface VoterRow {
  id: string;
  household_id: string;
  display_name: string | null;
  observed_party: string | null;
  calculated_party: string | null;
  official_party: string | null;
  current_status: string;
}

interface HouseholdRow {
  id: string;
  lat: number | string;
  lng: number | string;
}

interface KnockEventRow {
  household_id: string;
  voter_id: string | null;
  knocked_at: string;
  status: string;
}

interface CommitmentRow {
  voter_id: string | null;
  household_id: string;
  promised_at: string;
  resolved_at: string | null;
}

export async function scoreVoters(
  supabase: SupabaseClient,
  ctx: ScoreContext,
): Promise<ScoredVoter[]> {
  const weights: ScoreWeights = { ...DEFAULT_WEIGHTS, ...(ctx.weights ?? {}) };

  const ninetyMinAgo = new Date(ctx.now.getTime() - 90 * 60_000).toISOString();

  // Fetch in parallel — voters, households, recent events, open commitments.
  const [votersRes, eventsRes, commitsRes] = await Promise.all([
    supabase
      .from("voters")
      .select(
        "id, household_id, display_name, observed_party, calculated_party, official_party, current_status, moved",
      )
      .eq("district_id", ctx.districtId)
      .eq("moved", false)
      .neq("current_status", "contacted")
      .neq("current_status", "refused"),
    supabase
      .from("knock_events")
      .select("household_id, voter_id, knocked_at, status")
      .gte("knocked_at", new Date(ctx.now.getTime() - 30 * 24 * 3600_000).toISOString()),
    safeCommitmentSelect(supabase, ctx.now),
  ]);

  if (votersRes.error) {
    console.error("[queue.score] voters query failed", votersRes.error);
    return [];
  }
  if (eventsRes.error) {
    console.error("[queue.score] events query failed", eventsRes.error);
  }

  const voters = (votersRes.data ?? []) as VoterRow[];
  const events = (eventsRes.data ?? []) as KnockEventRow[];
  const commits = commitsRes;

  if (voters.length === 0) return [];

  const householdIds = Array.from(new Set(voters.map((v) => v.household_id)));
  const hhsRes = await supabase
    .from("households")
    .select("id, lat, lng")
    .in("id", householdIds);
  if (hhsRes.error) {
    console.error("[queue.score] households query failed", hhsRes.error);
    return [];
  }
  const hhById = new Map<string, { lat: number; lng: number }>();
  for (const h of (hhsRes.data ?? []) as HouseholdRow[]) {
    hhById.set(h.id, { lat: Number(h.lat), lng: Number(h.lng) });
  }

  // Pre-aggregate signals derived from event history.
  const knockCountByVoter = new Map<string, number>();
  const lastKnockByVoter = new Map<string, Date>();
  const recentByHousehold = new Map<string, Date>(); // most-recent knock per household
  for (const e of events) {
    const t = new Date(e.knocked_at);
    if (e.voter_id) {
      knockCountByVoter.set(e.voter_id, (knockCountByVoter.get(e.voter_id) ?? 0) + 1);
      const prior = lastKnockByVoter.get(e.voter_id);
      if (!prior || t > prior) lastKnockByVoter.set(e.voter_id, t);
    }
    const priorH = recentByHousehold.get(e.household_id);
    if (!priorH || t > priorH) recentByHousehold.set(e.household_id, t);
  }
  const commitByVoter = new Map<string, Date>();
  const commitByHousehold = new Map<string, Date>();
  for (const c of commits) {
    if (c.resolved_at) continue;
    const promised = new Date(c.promised_at);
    if (c.voter_id) commitByVoter.set(c.voter_id, promised);
    commitByHousehold.set(c.household_id, promised);
  }

  const day = ctx.now.getDay();
  const hour = ctx.now.getHours();
  const baseline = defaultAtHomeRate(day, hour);

  // First pass — score everything except cluster bonus (needs the population).
  const partial: ScoredVoter[] = [];
  for (const v of voters) {
    const hh = hhById.get(v.household_id);
    if (!hh) continue;

    const time_of_day = baseline; // no age adjustment until we have birth_year

    const party = v.observed_party ?? v.calculated_party ?? v.official_party ?? null;
    const priority = priorityScore(party, ctx.targetParty);

    const proximity = ctx.gps
      ? proximityScore(metresBetween(ctx.gps, hh))
      : 0.3; // bootstrap: no GPS yet → mild positive bias on every voter

    const freshness = freshnessScore({
      knockCount: knockCountByVoter.get(v.id) ?? 0,
      lastKnockAt: lastKnockByVoter.get(v.id) ?? null,
      now: ctx.now,
    });

    const commitment = commitmentScore({
      voterPromise: commitByVoter.get(v.id) ?? null,
      householdPromise: commitByHousehold.get(v.household_id) ?? null,
      now: ctx.now,
    });

    const recent = recentByHousehold.get(v.household_id);
    const recent_attempt = recent && recent.toISOString() >= ninetyMinAgo ? 1 : 0;

    partial.push({
      voterId: v.id,
      householdId: v.household_id,
      lat: hh.lat,
      lng: hh.lng,
      displayName: v.display_name?.trim() || "Unnamed voter",
      party,
      score: 0, // computed after cluster pass
      signals: {
        time_of_day,
        priority,
        proximity,
        freshness,
        commitment,
        cluster: 0,
        recent_attempt,
      },
    });
  }

  // Cluster bonus — count peers within 200m for the top 50 by current
  // (score-without-cluster). Computed once for the session.
  const provisional = partial
    .map((v) => ({
      v,
      provisional:
        weights.time_of_day * v.signals.time_of_day +
        weights.priority * v.signals.priority +
        weights.proximity * v.signals.proximity +
        weights.freshness * v.signals.freshness +
        weights.commitment * v.signals.commitment -
        weights.recent_attempt_penalty * v.signals.recent_attempt,
    }))
    .sort((a, b) => b.provisional - a.provisional);

  const top50 = provisional.slice(0, 50).map((p) => p.v);
  for (const v of partial) {
    let count = 0;
    for (const peer of top50) {
      if (peer.voterId === v.voterId) continue;
      if (metresBetween(v, peer) <= 200) count += 1;
    }
    v.signals.cluster = Math.min(1, count / 10);
  }

  // Final score.
  for (const v of partial) {
    v.score =
      weights.time_of_day * v.signals.time_of_day +
      weights.priority * v.signals.priority +
      weights.proximity * v.signals.proximity +
      weights.freshness * v.signals.freshness +
      weights.commitment * v.signals.commitment +
      weights.cluster * v.signals.cluster -
      weights.recent_attempt_penalty * v.signals.recent_attempt;
  }

  return partial.sort((a, b) => b.score - a.score);
}

function priorityScore(voterParty: string | null, targetParty: string | null): number {
  if (!targetParty) return 0.5; // non-partisan campaign → all voters mid
  if (!voterParty) return 0.5;
  const v = voterParty.toLowerCase();
  const t = targetParty.toLowerCase();
  if (v === t) return 1.0;
  if (
    v === "independent" ||
    v === "unaffiliated" ||
    v === "non-partisan" ||
    v === "no party" ||
    v === "other"
  ) {
    return 0.5;
  }
  return 0.0; // opposite party
}

function proximityScore(metres: number | null): number {
  if (metres == null) return 0.3;
  // Approximate at 80m/min walking: 2 min ≈ 160m, 5 min ≈ 400m, 15 ≈ 1200m.
  if (metres <= 160) return 1.0;
  if (metres <= 400) return 0.7;
  if (metres <= 1200) return 0.4;
  if (metres <= 2400) return 0.1;
  return 0.0;
}

function freshnessScore({
  knockCount,
  lastKnockAt,
  now,
}: {
  knockCount: number;
  lastKnockAt: Date | null;
  now: Date;
}): number {
  if (knockCount === 0) return 1.0;
  if (lastKnockAt && now.getTime() - lastKnockAt.getTime() > 30 * 24 * 3600_000) return 0.8;
  if (knockCount === 1) return 0.5;
  if (knockCount === 2) return 0.3;
  if (knockCount === 3) return 0.1;
  return 0.05;
}

function commitmentScore({
  voterPromise,
  householdPromise,
  now,
}: {
  voterPromise: Date | null;
  householdPromise: Date | null;
  now: Date;
}): number {
  const promise = voterPromise ?? householdPromise;
  if (!promise) return 0;
  const diffMs = Math.abs(promise.getTime() - now.getTime());
  if (diffMs <= 30 * 60_000) return 1.0;
  if (diffMs <= 2 * 3600_000) return 0.7;
  // same day?
  const sameDay =
    promise.getFullYear() === now.getFullYear() &&
    promise.getMonth() === now.getMonth() &&
    promise.getDate() === now.getDate();
  if (sameDay) return 0.4;
  if (promise > now) return 0.2;
  return 0;
}

export function metresBetween(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371000;
  const toRad = (n: number) => (n * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

async function safeCommitmentSelect(
  supabase: SupabaseClient,
  _now: Date,
): Promise<CommitmentRow[]> {
  // household_commitments may not exist on every DB yet; tolerate gracefully.
  const res = await supabase
    .from("household_commitments")
    .select("voter_id, household_id, promised_at, resolved_at")
    .is("resolved_at", null);
  if (res.error) {
    if ((res.error as { code?: string }).code === "42P01") return [];
    return [];
  }
  return (res.data ?? []) as CommitmentRow[];
}
