// Ephemeral walkbook generation.
// VOTER_QUEUE brief § 3.1 algorithm, packed into a single function.

import type { SupabaseClient } from "@supabase/supabase-js";
import { scoreVoters, metresBetween, type ScoredVoter } from "./score";

export interface GenerateOptions {
  knockerId: string;
  districtId: string;
  targetMinutes: number; // 30, 60, 120, 180, 480 ("all day")
  paceMultiplier?: number; // slow=1.3 medium=1.0 fast=0.7
  travelMode?: "walking" | "driving";
  gps?: { lat: number; lng: number } | null;
  targetParty?: string | null;
  now?: Date;
  defaultContactSeconds?: number; // base contact time per voter
}

export interface GeneratedWalkbook {
  walkbookId: string;
  voters: Array<ScoredVoter & { routeOrder: number; isBacklog: boolean }>;
  voterCount: number;
  estimatedMinutes: number;
  startingLatLng: { lat: number; lng: number } | null;
}

interface DistrictRow {
  id: string;
  name: string;
  timezone: string;
}

const ALL_DAY_MINUTES = 480;
const BRIEFING_BUFFER_MIN = 2;
const WRAP_BUFFER_MIN = 3;
const MIN_SCORE = 0.15;
const PACK_MIN_SCORE = 0.2;
const MAX_TRAVEL_MIN_BETWEEN_STOPS = 8;
const MAX_TRAVEL_FROM_GPS_MIN = 30;
const SECONDS_PER_M_WALKING = 60 / 80; // ~80 m/min
const SECONDS_PER_M_DRIVING = 60 / 600; // ~36 km/h baseline

export async function generateWalkbook(
  supabase: SupabaseClient,
  opts: GenerateOptions,
): Promise<GeneratedWalkbook> {
  const now = opts.now ?? new Date();
  const paceMultiplier = opts.paceMultiplier ?? 1.0;
  const travelMode = opts.travelMode ?? "walking";
  const baseContactSeconds = opts.defaultContactSeconds ?? 90;
  const contactSecondsPer = baseContactSeconds * paceMultiplier;

  // Pull district once for fallback centroid + scoring weight overrides.
  const { data: district } = await supabase
    .from("districts")
    .select("id, name, timezone")
    .eq("id", opts.districtId)
    .maybeSingle();
  const districtRow = district as DistrictRow | null;
  if (!districtRow) {
    throw new Error("district not found");
  }

  // GPS fallback to district centroid (not stored on districts; for v1
  // we use the average of household coordinates if no GPS).
  let gps = opts.gps ?? null;
  if (!gps) {
    const { data: anchor } = await supabase
      .from("households")
      .select("lat, lng")
      .eq("district_id", opts.districtId)
      .limit(1)
      .maybeSingle();
    if (anchor) {
      gps = {
        lat: Number((anchor as { lat: number | string }).lat),
        lng: Number((anchor as { lng: number | string }).lng),
      };
    }
  }

  // STEP 2 — score every candidate.
  const scored = await scoreVoters(supabase, {
    districtId: opts.districtId,
    now,
    gps,
    targetParty: opts.targetParty ?? null,
  });

  // STEP 3 — filter and trim.
  const filtered = scored.filter((v) => {
    if (v.score < MIN_SCORE) return false;
    if (gps) {
      const m = metresBetween(gps, { lat: v.lat, lng: v.lng });
      const minutes = travelMinutesForMetres(m, travelMode);
      if (minutes > MAX_TRAVEL_FROM_GPS_MIN) return false;
    }
    return true;
  });

  const candidatePool = opts.targetMinutes === ALL_DAY_MINUTES
    ? filtered.slice(0, 100)
    : filtered.slice(0, 200);

  // STEP 4 — time budget.
  const availableMinutes =
    opts.targetMinutes === ALL_DAY_MINUTES
      ? ALL_DAY_MINUTES
      : Math.max(5, opts.targetMinutes - BRIEFING_BUFFER_MIN - WRAP_BUFFER_MIN);

  // STEP 5 — greedy pack.
  const active: ScoredVoter[] = [];
  const used = new Set<string>();
  let accumulatedSeconds = 0;
  // Seed with the highest-scoring voter as the first stop.
  if (candidatePool[0]) {
    active.push(candidatePool[0]);
    used.add(candidatePool[0].voterId);
    accumulatedSeconds += contactSecondsPer;
  }
  while (true) {
    const last = active[active.length - 1];
    if (!last) break;
    const remainingSeconds = availableMinutes * 60 - accumulatedSeconds;
    if (remainingSeconds <= contactSecondsPer && opts.targetMinutes !== ALL_DAY_MINUTES) {
      break;
    }

    let bestIdx = -1;
    let bestCost = Number.POSITIVE_INFINITY;
    for (let i = 0; i < candidatePool.length; i++) {
      const cand = candidatePool[i]!;
      if (used.has(cand.voterId)) continue;
      if (cand.score < PACK_MIN_SCORE) continue;
      const travelM = metresBetween(last, cand);
      const travelMinutes = travelMinutesForMetres(travelM, travelMode);
      if (travelMinutes > MAX_TRAVEL_MIN_BETWEEN_STOPS) continue;
      const cost = travelMinutes * 60 + contactSecondsPer;
      if (cost < bestCost) {
        bestCost = cost;
        bestIdx = i;
      }
    }
    if (bestIdx === -1) break;
    if (
      opts.targetMinutes !== ALL_DAY_MINUTES &&
      bestCost > remainingSeconds
    ) {
      break;
    }
    const next = candidatePool[bestIdx]!;
    active.push(next);
    used.add(next.voterId);
    accumulatedSeconds += bestCost;

    if (active.length >= 100) break; // hard cap
  }

  // STEP 6 — TSP nearest-neighbor on the active set, keeping the
  // highest-scored voter as start (or starting from current GPS, whichever
  // produces the shorter total travel).
  const route = nearestNeighborOrder(active, gps);

  // Backlog: 50% extra candidates that didn't fit, surfaced if active depletes.
  const backlogTarget = Math.ceil(active.length * 0.5);
  const backlog: ScoredVoter[] = [];
  for (const cand of candidatePool) {
    if (used.has(cand.voterId)) continue;
    if (cand.score < MIN_SCORE) continue;
    backlog.push(cand);
    used.add(cand.voterId);
    if (backlog.length >= backlogTarget) break;
  }

  const startingLatLng = route[0] ? { lat: route[0].lat, lng: route[0].lng } : gps;

  // STEP 7 — persist.
  const { data: wbInsert, error: wbErr } = await supabase
    .from("walkbooks")
    .insert({
      district_id: opts.districtId,
      knocker_id: opts.knockerId,
      name: `Session ${formatDateLocal(now)}`,
      kind: "dynamic",
      ephemeral: true,
      status: "open",
      target_duration_minutes: opts.targetMinutes,
      pace_multiplier: paceMultiplier,
      travel_mode: travelMode,
      voters_planned: route.length,
      starting_lat: startingLatLng?.lat ?? null,
      starting_lng: startingLatLng?.lng ?? null,
      household_count: route.length,
      auto_generated: true,
      generation_seed: cryptoSafeRandomString(),
      expires_at: new Date(now.getTime() + 12 * 3600_000).toISOString(),
    })
    .select("id")
    .single();
  if (wbErr || !wbInsert) {
    throw new Error(wbErr?.message ?? "could not create walkbook");
  }
  const walkbookId = (wbInsert as { id: string }).id;

  const voterRows = [
    ...route.map((v, i) => ({
      walkbook_id: walkbookId,
      voter_id: v.voterId,
      household_id: v.householdId,
      route_order: i,
      score_at_generation: round3(v.score),
      is_backlog: false,
    })),
    ...backlog.map((v, i) => ({
      walkbook_id: walkbookId,
      voter_id: v.voterId,
      household_id: v.householdId,
      route_order: route.length + i,
      score_at_generation: round3(v.score),
      is_backlog: true,
    })),
  ];

  // Mirror household rows so the legacy walkbook_households readers
  // (admin /app/walkbooks list, map-view bbox calc) still work.
  const householdSeen = new Set<string>();
  const hhRows: Array<{ walkbook_id: string; household_id: string; order_index: number }> = [];
  for (let i = 0; i < route.length; i++) {
    const v = route[i]!;
    if (householdSeen.has(v.householdId)) continue;
    householdSeen.add(v.householdId);
    hhRows.push({
      walkbook_id: walkbookId,
      household_id: v.householdId,
      order_index: i,
    });
  }

  if (voterRows.length > 0) {
    const { error: voterInsertErr } = await supabase.from("walkbook_voters").insert(voterRows);
    if (voterInsertErr) {
      console.error("[queue.generate] walkbook_voters insert failed", voterInsertErr);
    }
  }
  if (hhRows.length > 0) {
    const { error: hhInsertErr } = await supabase
      .from("walkbook_households")
      .insert(hhRows);
    if (hhInsertErr) {
      console.warn("[queue.generate] walkbook_households mirror failed", hhInsertErr);
    }
  }

  const estimatedMinutes = Math.round(accumulatedSeconds / 60);

  return {
    walkbookId,
    voters: [
      ...route.map((v, i) => ({ ...v, routeOrder: i, isBacklog: false })),
      ...backlog.map((v, i) => ({ ...v, routeOrder: route.length + i, isBacklog: true })),
    ],
    voterCount: route.length,
    estimatedMinutes,
    startingLatLng,
  };
}

function travelMinutesForMetres(m: number, mode: "walking" | "driving"): number {
  const sec = m * (mode === "driving" ? SECONDS_PER_M_DRIVING : SECONDS_PER_M_WALKING);
  return sec / 60;
}

function nearestNeighborOrder(
  voters: ScoredVoter[],
  start: { lat: number; lng: number } | null,
): ScoredVoter[] {
  if (voters.length <= 1) return voters;

  const remaining = [...voters];
  const ordered: ScoredVoter[] = [];

  // Two starting strategies — pick the one with shorter total travel.
  const fromHighScore = greedyTour(remaining, voters[0]!);
  if (start) {
    const nearestToGps = remaining.reduce((best, cand) => {
      const d = metresBetween(start, cand);
      return d < best.d ? { d, v: cand } : best;
    }, { d: Number.POSITIVE_INFINITY, v: voters[0]! }).v;
    const fromGpsClosest = greedyTour(remaining, nearestToGps);
    if (totalLength(fromGpsClosest) < totalLength(fromHighScore)) {
      ordered.push(...fromGpsClosest);
      return ordered;
    }
  }
  ordered.push(...fromHighScore);
  return ordered;
}

function greedyTour(pool: ScoredVoter[], start: ScoredVoter): ScoredVoter[] {
  const remaining = pool.filter((v) => v.voterId !== start.voterId);
  const out: ScoredVoter[] = [start];
  let current: ScoredVoter = start;
  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestD = Number.POSITIVE_INFINITY;
    for (let i = 0; i < remaining.length; i++) {
      const d = metresBetween(current, remaining[i]!);
      if (d < bestD) {
        bestD = d;
        bestIdx = i;
      }
    }
    current = remaining.splice(bestIdx, 1)[0]!;
    out.push(current);
  }
  return out;
}

function totalLength(tour: ScoredVoter[]): number {
  let total = 0;
  for (let i = 1; i < tour.length; i++) {
    total += metresBetween(tour[i - 1]!, tour[i]!);
  }
  return total;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function formatDateLocal(d: Date): string {
  return d
    .toISOString()
    .replace("T", " ")
    .replace(/:\d{2}\..*/, "");
}

function cryptoSafeRandomString(): string {
  const bytes = new Uint8Array(8);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
