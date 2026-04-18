// Dynamic walkbook generator — greedy orienteering. See SPEC §5.2.
//
// Given a start location, a time budget, and a candidate set, return an
// ordered subset of stops that fits the budget and maximizes door count.
// This is the algorithm behind "Walk from here".
//
// Approach:
//   1. Prune candidates: drop anything further than max_initial_walk from start.
//   2. Seed: greedy nearest-neighbor from start, stop when adding the next
//      door would push the estimate over budget.
//   3. Refine: 2-opt on the seed (already imported from optimizer).
//   4. Insert: try to squeeze in nearby un-picked candidates until no
//      insertion keeps the estimate under budget.

import { haversineMeters } from "@/lib/geo/distance";
import {
  DEFAULT_CALIBRATION,
  estimateMinutes,
  type EstimatorCalibration,
  type EstimatorStop,
} from "./estimator";
import { optimize, routeMeters, type OptimizerStop } from "./optimizer";

export interface DynamicCandidate extends EstimatorStop, OptimizerStop {
  id: string;
  lat: number;
  lng: number;
}

export interface DynamicOptions {
  start: { lat: number; lng: number };
  budgetMinutes: number;
  calibration?: EstimatorCalibration;
  maxInitialWalkMinutes?: number; // distance-prune threshold
}

export interface DynamicResult<T extends DynamicCandidate = DynamicCandidate> {
  orderedStops: T[];
  estimatedMinutes: number;
  travelMinutes: number;
  contactMinutes: number;
  pickedFromCandidates: number;
}

export function generateDynamicWalkbook<T extends DynamicCandidate>(
  candidates: T[],
  options: DynamicOptions,
): DynamicResult<T> {
  const {
    start,
    budgetMinutes,
    calibration = DEFAULT_CALIBRATION,
    maxInitialWalkMinutes = 15,
  } = options;

  if (candidates.length === 0) {
    return { orderedStops: [], estimatedMinutes: 0, travelMinutes: 0, contactMinutes: 0, pickedFromCandidates: 0 };
  }

  // Distance prune.
  const walkingSpeedMps = (calibration.avg_walking_speed_kmh * 1000) / 3600;
  const maxMeters = maxInitialWalkMinutes * 60 * walkingSpeedMps;
  const nearby = candidates.filter((c) => haversineMeters(start, c) <= maxMeters);
  if (nearby.length === 0) {
    return { orderedStops: [], estimatedMinutes: 0, travelMinutes: 0, contactMinutes: 0, pickedFromCandidates: 0 };
  }

  // Seed: nearest-neighbor, stopping when adding next stop exceeds budget.
  const remaining = nearby.slice();
  const route: T[] = [];
  let cursor = { lat: start.lat, lng: start.lng };
  while (remaining.length > 0) {
    let bestIdx = -1;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineMeters(cursor, remaining[i]);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    if (bestIdx < 0) break;
    const candidate = remaining[bestIdx];
    const probe = [...route, candidate];
    const probeEst = estimateMinutes(probe, calibration).totalMinutes;
    if (probeEst > budgetMinutes) break;
    route.push(candidate);
    cursor = candidate;
    remaining.splice(bestIdx, 1);
  }

  // Refine with 2-opt.
  const refined = optimize(route).order as T[];

  // Insertion: try every un-picked candidate; if inserting at its best
  // position keeps estimate ≤ budget, keep it.
  for (const cand of remaining) {
    const { bestIdx, bestEst } = findBestInsertion(refined, cand, calibration);
    if (bestIdx >= 0 && bestEst <= budgetMinutes) {
      refined.splice(bestIdx, 0, cand);
    }
  }

  const finalEst = estimateMinutes(refined, calibration);
  return {
    orderedStops: refined,
    estimatedMinutes: finalEst.totalMinutes,
    travelMinutes: finalEst.travelMinutes,
    contactMinutes: finalEst.contactMinutes,
    pickedFromCandidates: refined.length,
  };
}

function findBestInsertion<T extends DynamicCandidate>(
  route: T[],
  cand: T,
  cal: EstimatorCalibration,
): { bestIdx: number; bestEst: number } {
  let bestIdx = -1;
  let bestEst = Infinity;
  for (let i = 0; i <= route.length; i++) {
    const probe = [...route.slice(0, i), cand, ...route.slice(i)];
    const est = estimateMinutes(probe, cal).totalMinutes;
    if (est < bestEst) {
      bestEst = est;
      bestIdx = i;
    }
  }
  return { bestIdx, bestEst };
}

// Used by /app/walkbooks/dynamic to show "travel meters saved" when user
// re-optimizes mid-session. Not strictly needed for W3 generation path.
export function routeLength<T extends DynamicCandidate>(route: T[]): number {
  return routeMeters(route);
}
