// Walkbook → volunteer assignment algorithm. LPT (longest processing time
// first) bin-packing with a geographic-clustering tiebreaker.
//
// Pure — no DB access. Server and client both import it: client uses it to
// compute the preview in the auto-assign modal; server re-runs identical
// math on commit.
//
// See WALKBOOK_ASSIGNMENT.md §5.3 for the algorithm contract.

export interface AssignWalkbook {
  id: string;
  durationMinutes: number;
  doors: number;
  centroidLat: number | null;
  centroidLng: number | null;
}

export interface AssignVolunteer {
  id: string;
  totalBudgetMinutes: number;
  speedFactor: number; // 0.85 | 1.0 | 1.2 — multiplier on bin size
}

export interface AssignOptions {
  optimizeFor: "time" | "doors";
  preferClustering: boolean;
  overloadTolerance?: number; // default 1.1
  clusterWeight?: number; // default 0.3
}

export interface AssignResult {
  assignments: Array<{ walkbookId: string; userId: string }>;
  overloaded: Array<{ userId: string; overshootMinutes: number }>;
  loadByUser: Map<string, number>;
  doorsByUser: Map<string, number>;
  variance: number;
  unassigned: string[]; // walkbooks that couldn't fit anywhere
}

export function computeAssignments(
  walkbooks: AssignWalkbook[],
  volunteers: AssignVolunteer[],
  options: AssignOptions,
): AssignResult {
  if (volunteers.length === 0) {
    return {
      assignments: [],
      overloaded: [],
      loadByUser: new Map(),
      doorsByUser: new Map(),
      variance: 0,
      unassigned: walkbooks.map((w) => w.id),
    };
  }

  const overloadTolerance = options.overloadTolerance ?? 1.1;
  const clusterWeight = options.clusterWeight ?? 0.3;

  // 1. Sort walkbooks descending by the optimization metric.
  const sorted = walkbooks.slice().sort((a, b) => {
    if (options.optimizeFor === "doors") return b.doors - a.doors;
    return b.durationMinutes - a.durationMinutes;
  });

  // 2. Running state per volunteer.
  const loadByUser = new Map<string, number>();
  const doorsByUser = new Map<string, number>();
  const centroidsByUser = new Map<string, Array<{ lat: number; lng: number }>>();
  const capacityByUser = new Map<string, number>();
  for (const v of volunteers) {
    loadByUser.set(v.id, 0);
    doorsByUser.set(v.id, 0);
    centroidsByUser.set(v.id, []);
    capacityByUser.set(v.id, v.totalBudgetMinutes * v.speedFactor);
  }

  const assignments: Array<{ walkbookId: string; userId: string }> = [];
  const overloaded: Array<{ userId: string; overshootMinutes: number }> = [];
  const unassigned: string[] = [];

  // 3. Greedy placement.
  for (const w of sorted) {
    const fits = volunteers.filter((v) => {
      const cap = capacityByUser.get(v.id) ?? 0;
      return (loadByUser.get(v.id) ?? 0) + w.durationMinutes <= cap * overloadTolerance;
    });

    const pool = fits.length > 0 ? fits : volunteers;
    let best: AssignVolunteer | null = null;
    let bestScore = -Infinity;

    for (const v of pool) {
      const load = loadByUser.get(v.id) ?? 0;
      let score = -load; // prefer lighter-loaded volunteers
      if (
        options.preferClustering &&
        w.centroidLat != null &&
        w.centroidLng != null &&
        (centroidsByUser.get(v.id)?.length ?? 0) > 0
      ) {
        const centroids = centroidsByUser.get(v.id)!;
        const avgDist =
          centroids.reduce(
            (sum, c) =>
              sum + haversineMeters({ lat: w.centroidLat!, lng: w.centroidLng! }, c),
            0,
          ) / centroids.length;
        // Lower distance = higher bonus. Normalise by 5km so weights balance.
        const bonus = Math.max(0, 5000 - avgDist) / 5000;
        score += clusterWeight * bonus * Math.abs(load || 1);
      }
      if (score > bestScore) {
        bestScore = score;
        best = v;
      }
    }

    if (!best) {
      unassigned.push(w.id);
      continue;
    }

    assignments.push({ walkbookId: w.id, userId: best.id });
    loadByUser.set(best.id, (loadByUser.get(best.id) ?? 0) + w.durationMinutes);
    doorsByUser.set(best.id, (doorsByUser.get(best.id) ?? 0) + w.doors);
    if (w.centroidLat != null && w.centroidLng != null) {
      centroidsByUser.get(best.id)!.push({ lat: w.centroidLat, lng: w.centroidLng });
    }

    // Record overloads after the fact.
    const cap = capacityByUser.get(best.id) ?? 0;
    const load = loadByUser.get(best.id) ?? 0;
    if (load > cap * overloadTolerance) {
      const existing = overloaded.find((o) => o.userId === best.id);
      const overshoot = load - cap;
      if (existing) existing.overshootMinutes = overshoot;
      else overloaded.push({ userId: best.id, overshootMinutes: overshoot });
    }
  }

  // Variance = stddev of per-volunteer loads (excluding zero-load users so
  // opt-out volunteers don't pull the metric around).
  const loads = Array.from(loadByUser.values()).filter((m) => m > 0);
  const mean = loads.length > 0 ? loads.reduce((a, b) => a + b, 0) / loads.length : 0;
  const variance =
    loads.length > 0
      ? Math.sqrt(loads.reduce((acc, m) => acc + (m - mean) ** 2, 0) / loads.length)
      : 0;

  return { assignments, overloaded, loadByUser, doorsByUser, variance, unassigned };
}

function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
