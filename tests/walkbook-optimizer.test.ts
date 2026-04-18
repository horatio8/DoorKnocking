import { describe, expect, it } from "vitest";
import { nearestNeighborRoute, optimize, routeMeters, twoOpt } from "../lib/walkbooks/optimizer";

function grid(n: number) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      pts.push({ id: `${i}-${j}`, lat: i * 0.001, lng: j * 0.001 });
    }
  }
  return pts;
}

describe("walkbook optimizer", () => {
  it("nearest-neighbor returns all input stops exactly once", () => {
    const pts = grid(3);
    const route = nearestNeighborRoute(pts, { lat: 0, lng: 0 });
    expect(route.length).toBe(pts.length);
    expect(new Set(route.map((p) => p.id)).size).toBe(pts.length);
  });

  it("2-opt produces a tour no longer than the seed", () => {
    const pts = grid(4);
    const seed = nearestNeighborRoute(pts, { lat: 0, lng: 0 });
    const seedMeters = routeMeters(seed);
    const { totalMeters } = twoOpt(seed);
    expect(totalMeters).toBeLessThanOrEqual(seedMeters);
  });

  it("optimize reports non-negative improvedFromSeed", () => {
    const pts = grid(5);
    const { improvedFromSeed } = optimize(pts);
    expect(improvedFromSeed).toBeGreaterThanOrEqual(0);
  });

  it("handles singleton and empty input", () => {
    expect(optimize([]).order).toEqual([]);
    const one = optimize([{ id: "x", lat: 1, lng: 1 }]).order;
    expect(one.length).toBe(1);
  });
});
