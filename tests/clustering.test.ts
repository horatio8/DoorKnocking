import { describe, expect, it } from "vitest";
import { clusterHouseholds } from "../lib/geo/clustering";

describe("clusterHouseholds", () => {
  it("returns a single cluster when count <= targetSize", () => {
    const pts = Array.from({ length: 10 }, (_, i) => ({
      id: `h${i}`,
      lat: 33.9 + i * 0.001,
      lng: -80.85,
    }));
    const clusters = clusterHouseholds(pts, 20);
    expect(clusters.length).toBe(1);
    expect(clusters[0].points.length).toBe(10);
  });

  it("splits into multiple clusters when count > targetSize", () => {
    const pts = Array.from({ length: 60 }, (_, i) => ({
      id: `h${i}`,
      lat: 33.9 + Math.random() * 0.05,
      lng: -80.85 + Math.random() * 0.05,
    }));
    const clusters = clusterHouseholds(pts, 20);
    expect(clusters.length).toBeGreaterThanOrEqual(3);
    const total = clusters.reduce((n, c) => n + c.points.length, 0);
    expect(total).toBe(60);
  });

  it("sorts clusters north-to-south", () => {
    const pts = [
      { id: "a", lat: 33.95, lng: -80.85 },
      { id: "b", lat: 33.85, lng: -80.85 },
      { id: "c", lat: 34.05, lng: -80.85 },
    ];
    const clusters = clusterHouseholds(pts, 1);
    expect(clusters[0].centroid.lat).toBeGreaterThan(clusters[1].centroid.lat);
  });
});
