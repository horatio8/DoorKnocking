// Walkbook generator — three-stage algorithm from SPEC § 3.2.
//
//   1. Seed clusters by geography (constrained k-means).
//   2. Route-optimize each cluster and compare estimated time to target.
//      - within ±15% → keep.
//      - too large → split along principal axis, recurse.
//      - too small → try to merge with nearest neighbour (under 1.15× target).
//   3. Name by centroid latitude (N→S), return.
//
// Pure: input households, output the planned clusters + routes + estimates.
// The API route is responsible for persisting the DB rows.

import { computeBoundingBox, computeCentroid } from "@/lib/geo/distance";
import { clusterHouseholds, type ClusterPoint } from "@/lib/geo/clustering";
import {
  DEFAULT_CALIBRATION,
  estimateMinutes,
  type EstimatorCalibration,
  type EstimatorStop,
} from "./estimator";
import { optimize, type OptimizerStop } from "./optimizer";

export interface GeneratorInput extends EstimatorStop, ClusterPoint, OptimizerStop {
  id: string;
  lat: number;
  lng: number;
}

export interface GeneratorOptions {
  targetDurationMinutes: number;
  calibration?: EstimatorCalibration;
  toleranceFraction?: number;   // default 0.15 (±15%)
  mergeCeilingFraction?: number;// default 1.15
  maxSplitDepth?: number;       // safety
}

export interface PlannedWalkbook<T extends GeneratorInput = GeneratorInput> {
  index: number;
  orderedStops: T[];
  centroid: { lat: number; lng: number };
  boundingBox: { north: number; south: number; east: number; west: number };
  estimatedMinutes: number;
  estimateDetail: {
    travelMinutes: number;
    contactMinutes: number;
    parkingMinutes: number;
  };
  seedMetersSaved: number;
}

export function generateWalkbooks<T extends GeneratorInput>(
  stops: T[],
  options: GeneratorOptions,
): PlannedWalkbook<T>[] {
  const {
    targetDurationMinutes,
    calibration = DEFAULT_CALIBRATION,
    toleranceFraction = 0.15,
    mergeCeilingFraction = 1.15,
    maxSplitDepth = 4,
  } = options;
  if (stops.length === 0) return [];

  const lowerBound = targetDurationMinutes * (1 - toleranceFraction);
  const upperBound = targetDurationMinutes * (1 + toleranceFraction);
  const mergeCeiling = targetDurationMinutes * mergeCeilingFraction;

  // Stage 1 — seed clusters. First guess for households-per-walkbook is
  // target / avg_contact_seconds_in_minutes, clamped to reasonable bounds.
  const avgContactMin = calibration.avg_contact_seconds / 60;
  const seedSize = clamp(Math.round(targetDurationMinutes / avgContactMin), 6, 60);
  const seedClusters = clusterHouseholds(stops, seedSize).map((c) =>
    c.points.map((p) => stops.find((s) => s.id === p.id)!).filter(Boolean),
  );

  // Stage 2 — optimize each cluster; split or prepare-to-merge.
  const keepers: T[][] = [];
  const toomallsmall: T[][] = [];
  for (const cluster of seedClusters) {
    processCluster(cluster, 0);
  }

  function processCluster(cluster: T[], depth: number): void {
    if (cluster.length === 0) return;
    const { order } = optimize(cluster);
    const est = estimateMinutes(order, calibration);
    if (est.totalMinutes >= lowerBound && est.totalMinutes <= upperBound) {
      keepers.push(order);
      return;
    }
    if (est.totalMinutes > upperBound && cluster.length >= 4 && depth < maxSplitDepth) {
      const halves = splitByPrincipalAxis(cluster);
      for (const half of halves) processCluster(half, depth + 1);
      return;
    }
    if (est.totalMinutes < lowerBound) {
      toomallsmall.push(order);
      return;
    }
    // Too large but too small to split meaningfully — keep anyway.
    keepers.push(order);
  }

  // Attempt to merge small clusters with nearest keeper (or with each other).
  mergeSmallClusters(toomallsmall, keepers, calibration, mergeCeiling);

  // Stage 3 — name N→S, attach estimate detail.
  const withMeta: PlannedWalkbook<T>[] = keepers.map((cluster) => {
    const { order, improvedFromSeed } = optimize(cluster);
    const est = estimateMinutes(order, calibration);
    const centroid = computeCentroid(order)!;
    const boundingBox = computeBoundingBox(order)!;
    return {
      index: 0,
      orderedStops: order,
      centroid,
      boundingBox,
      estimatedMinutes: est.totalMinutes,
      estimateDetail: {
        travelMinutes: est.travelMinutes,
        contactMinutes: est.contactMinutes,
        parkingMinutes: est.parkingMinutes,
      },
      seedMetersSaved: improvedFromSeed,
    };
  });

  withMeta.sort((a, b) => b.centroid.lat - a.centroid.lat);
  withMeta.forEach((w, i) => {
    w.index = i;
  });
  return withMeta;
}

// --- helpers ---

function splitByPrincipalAxis<T extends OptimizerStop>(points: T[]): T[][] {
  // Principal axis by simple variance comparison: if lat varies more than lng,
  // split by median lat; otherwise by median lng. 2-axis PCA would be more
  // accurate but adds dependencies for negligible improvement on a point
  // cloud this small.
  const latMean = mean(points.map((p) => p.lat));
  const lngMean = mean(points.map((p) => p.lng));
  const latVar = variance(points.map((p) => p.lat), latMean);
  const lngVar = variance(points.map((p) => p.lng), lngMean);
  const byLat = latVar >= lngVar;
  const sorted = points.slice().sort((a, b) => (byLat ? a.lat - b.lat : a.lng - b.lng));
  const mid = Math.floor(sorted.length / 2);
  return [sorted.slice(0, mid), sorted.slice(mid)];
}

function mergeSmallClusters<T extends GeneratorInput>(
  smalls: T[][],
  keepers: T[][],
  cal: EstimatorCalibration,
  ceiling: number,
): void {
  // For each small cluster, find the keeper whose centroid is closest whose
  // combined estimate would stay under `ceiling`. If none, leave the small
  // cluster as its own walkbook anyway — better a short walkbook than none.
  for (const small of smalls) {
    if (small.length === 0) continue;
    const smallCentroid = computeCentroid(small)!;
    let bestIdx = -1;
    let bestDistance = Infinity;
    let bestMerged: T[] | null = null;
    for (let i = 0; i < keepers.length; i++) {
      const keeper = keepers[i];
      const keeperCentroid = computeCentroid(keeper)!;
      const d = metersBetween(smallCentroid, keeperCentroid);
      if (d >= bestDistance) continue;
      const combined = [...keeper, ...small];
      const { order } = optimize(combined);
      const est = estimateMinutes(order, cal);
      if (est.totalMinutes <= ceiling) {
        bestDistance = d;
        bestIdx = i;
        bestMerged = order;
      }
    }
    if (bestIdx >= 0 && bestMerged) {
      keepers[bestIdx] = bestMerged;
    } else {
      keepers.push(small);
    }
  }
}

function metersBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function variance(xs: number[], m: number): number {
  if (xs.length === 0) return 0;
  return xs.reduce((acc, x) => acc + (x - m) ** 2, 0) / xs.length;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
