// Constrained k-means for walkbook generation.
// Produces clusters of ~targetSize households that are geographically coherent.

import { computeBoundingBox, computeCentroid, haversineMeters } from "./distance";

export interface ClusterPoint {
  id: string;
  lat: number;
  lng: number;
  weight?: number;
}

export interface ClusterResult {
  index: number;
  centroid: { lat: number; lng: number };
  boundingBox: { north: number; south: number; east: number; west: number };
  estimatedDurationMinutes: number;
  points: ClusterPoint[];
}

const WALKING_SPEED_MPH = 3;
const WINDING_FACTOR = 1.4;
const MAX_ITERATIONS = 25;
const MAX_DURATION_MINUTES = 90;

function pickInitialCentroids(points: ClusterPoint[], k: number) {
  // Deterministic "farthest-first" seeding so reruns are stable.
  const centroids = [points[0]];
  while (centroids.length < k) {
    let best: ClusterPoint | null = null;
    let bestMinDist = -1;
    for (const p of points) {
      let minDist = Infinity;
      for (const c of centroids) {
        const d = haversineMeters(p, c);
        if (d < minDist) minDist = d;
      }
      if (minDist > bestMinDist) {
        bestMinDist = minDist;
        best = p;
      }
    }
    if (!best) break;
    centroids.push(best);
  }
  return centroids.map((p) => ({ lat: p.lat, lng: p.lng }));
}

function estimateMinutes(points: ClusterPoint[]): number {
  if (points.length < 2) return 5;
  const sorted = [...points].sort((a, b) => a.lat - b.lat);
  let meters = 0;
  for (let i = 1; i < sorted.length; i++) {
    meters += haversineMeters(sorted[i - 1], sorted[i]);
  }
  const effectiveMeters = meters * WINDING_FACTOR;
  const hours = effectiveMeters / 1609.344 / WALKING_SPEED_MPH;
  // Add 2 minutes per door for conversation overhead
  return Math.ceil(hours * 60 + points.length * 2);
}

export function clusterHouseholds(
  points: ClusterPoint[],
  targetSize: number,
): ClusterResult[] {
  if (points.length === 0) return [];
  const k = Math.max(1, Math.ceil(points.length / targetSize));
  if (k === 1) {
    return [toResult(0, points)];
  }

  let centroids = pickInitialCentroids(points, k);
  let assignments = new Array(points.length).fill(0);

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    let changed = false;
    // Assign each point to closest centroid.
    const loads = new Array(k).fill(0);
    const ordered = points
      .map((p, idx) => {
        const distances = centroids.map((c) => haversineMeters(p, c));
        return { idx, p, distances };
      })
      .sort((a, b) => Math.min(...a.distances) - Math.min(...b.distances));

    for (const item of ordered) {
      const sortedCentroids = item.distances
        .map((d, i) => ({ i, d }))
        .sort((x, y) => x.d - y.d);
      let pick = sortedCentroids[0].i;
      // Constraint: prefer under-capacity centroid unless distance penalty is too high
      for (const c of sortedCentroids) {
        if (loads[c.i] < targetSize) {
          pick = c.i;
          break;
        }
      }
      if (assignments[item.idx] !== pick) changed = true;
      assignments[item.idx] = pick;
      loads[pick]++;
    }

    // Recompute centroids
    const newCentroids = centroids.map((_, i) => {
      const members = points.filter((_, idx) => assignments[idx] === i);
      return computeCentroid(members) ?? centroids[i];
    });
    centroids = newCentroids;
    if (!changed) break;
  }

  const clusters: ClusterResult[] = [];
  for (let i = 0; i < k; i++) {
    const members = points.filter((_, idx) => assignments[idx] === i);
    if (members.length === 0) continue;
    clusters.push(toResult(i, members));
  }

  // Subdivide any cluster that blows past the duration ceiling.
  const finalClusters: ClusterResult[] = [];
  for (const c of clusters) {
    if (c.estimatedDurationMinutes > MAX_DURATION_MINUTES && c.points.length > targetSize / 2) {
      const sub = clusterHouseholds(c.points, Math.ceil(c.points.length / 2));
      finalClusters.push(...sub);
    } else {
      finalClusters.push(c);
    }
  }

  // Sort north-to-south for stable naming.
  finalClusters.sort((a, b) => b.centroid.lat - a.centroid.lat);
  return finalClusters.map((c, idx) => ({ ...c, index: idx }));
}

function toResult(index: number, points: ClusterPoint[]): ClusterResult {
  const centroid = computeCentroid(points)!;
  const boundingBox = computeBoundingBox(points)!;
  return {
    index,
    centroid,
    boundingBox,
    estimatedDurationMinutes: estimateMinutes(points),
    points,
  };
}
