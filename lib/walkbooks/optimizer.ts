// Walkbook route optimizer — nearest-neighbor seed + 2-opt refinement.
// See SPEC § 6.2. Pure and synchronous so the admin generator and the
// knocker client can share it.
//
// Distance metric here is great-circle haversine meters * winding factor.
// Phase W1 ships without real-road distances; phase W2 preview + dynamic
// mode upgrade to Mapbox Directions for the final polyline/time.

import { haversineMeters } from "@/lib/geo/distance";

export interface OptimizerStop {
  id: string;
  lat: number;
  lng: number;
}

export interface OptimizeOptions {
  start?: { lat: number; lng: number };
  maxIterations?: number;
}

export interface OptimizeResult<T extends OptimizerStop> {
  order: T[];
  totalMeters: number;
  improvedFromSeed: number;
}

// Nearest-neighbor seed: start at `start` (or the first stop if none given),
// greedily pick the closest un-visited stop until all are consumed.
export function nearestNeighborRoute<T extends OptimizerStop>(
  stops: T[],
  start?: { lat: number; lng: number },
): T[] {
  if (stops.length === 0) return [];
  const remaining = stops.slice();
  const route: T[] = [];

  let cursor: { lat: number; lng: number };
  if (start) {
    cursor = start;
  } else {
    route.push(remaining.shift()!);
    cursor = route[0];
  }

  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineMeters(cursor, remaining[i]);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    const next = remaining.splice(bestIdx, 1)[0];
    route.push(next);
    cursor = next;
  }
  return route;
}

// 2-opt: repeatedly reverse the segment between i and j if doing so shortens
// the tour. Runs until no improving swap exists on a full pass, up to
// maxIterations full passes.
export function twoOpt<T extends OptimizerStop>(
  route: T[],
  maxIterations = 50,
): { route: T[]; totalMeters: number; iterations: number } {
  const r = route.slice();
  let improved = true;
  let iterations = 0;
  while (improved && iterations < maxIterations) {
    improved = false;
    iterations++;
    for (let i = 1; i < r.length - 1; i++) {
      for (let j = i + 1; j < r.length; j++) {
        const gain = twoOptGain(r, i, j);
        if (gain > 0) {
          reverseSegment(r, i, j);
          improved = true;
        }
      }
    }
  }
  return { route: r, totalMeters: routeMeters(r), iterations };
}

export function optimize<T extends OptimizerStop>(
  stops: T[],
  options: OptimizeOptions = {},
): OptimizeResult<T> {
  if (stops.length <= 1) {
    return { order: stops.slice(), totalMeters: 0, improvedFromSeed: 0 };
  }
  const seed = nearestNeighborRoute(stops, options.start);
  const seedMeters = routeMeters(seed);
  const refined = twoOpt(seed, options.maxIterations);
  return {
    order: refined.route,
    totalMeters: refined.totalMeters,
    improvedFromSeed: Math.max(0, seedMeters - refined.totalMeters),
  };
}

// --- helpers ---

function twoOptGain<T extends OptimizerStop>(r: T[], i: number, j: number): number {
  // Swap edges (r[i-1] -> r[i]) and (r[j] -> r[j+1]) with
  // (r[i-1] -> r[j]) and (r[i] -> r[j+1]). Gain = removed - added.
  const a = r[i - 1];
  const b = r[i];
  const c = r[j];
  const d = j + 1 < r.length ? r[j + 1] : null;

  const removed = haversineMeters(a, b) + (d ? haversineMeters(c, d) : 0);
  const added = haversineMeters(a, c) + (d ? haversineMeters(b, d) : 0);
  return removed - added;
}

function reverseSegment<T>(r: T[], i: number, j: number): void {
  while (i < j) {
    const t = r[i];
    r[i] = r[j];
    r[j] = t;
    i++;
    j--;
  }
}

export function routeMeters<T extends OptimizerStop>(route: T[]): number {
  let m = 0;
  for (let i = 1; i < route.length; i++) {
    m += haversineMeters(route[i - 1], route[i]);
  }
  return m;
}
