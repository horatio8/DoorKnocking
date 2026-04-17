import { describe, expect, it } from "vitest";
import { haversineMeters, metersToMiles, computeBoundingBox, computeCentroid } from "../lib/geo/distance";

describe("haversineMeters", () => {
  it("returns 0 for identical points", () => {
    const p = { lat: 33.93, lng: -80.85 };
    expect(haversineMeters(p, p)).toBe(0);
  });

  it("matches a known distance (SC Capitol → Charleston, ~170km)", () => {
    const d = haversineMeters(
      { lat: 34.0007, lng: -81.0348 },
      { lat: 32.7765, lng: -79.9311 },
    );
    expect(d / 1000).toBeGreaterThan(150);
    expect(d / 1000).toBeLessThan(180);
  });
});

describe("metersToMiles", () => {
  it("converts", () => {
    expect(metersToMiles(1609.344)).toBeCloseTo(1);
  });
});

describe("computeBoundingBox", () => {
  it("returns null for empty input", () => {
    expect(computeBoundingBox([])).toBeNull();
  });
  it("computes min/max", () => {
    const box = computeBoundingBox([
      { lat: 1, lng: 2 },
      { lat: 3, lng: 0 },
    ]);
    expect(box).toEqual({ north: 3, south: 1, east: 2, west: 0 });
  });
});

describe("computeCentroid", () => {
  it("averages lat/lng", () => {
    const c = computeCentroid([
      { lat: 0, lng: 0 },
      { lat: 2, lng: 4 },
    ]);
    expect(c).toEqual({ lat: 1, lng: 2 });
  });
});
