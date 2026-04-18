import { describe, expect, it } from "vitest";
import { DEFAULT_CALIBRATION, estimateMinutes } from "../lib/walkbooks/estimator";

describe("estimateMinutes", () => {
  it("returns zero for an empty list", () => {
    expect(estimateMinutes([]).totalMinutes).toBe(0);
  });

  it("counts only contact time for a single stop", () => {
    const out = estimateMinutes([{ id: "a", lat: 33.9, lng: -80.85 }]);
    expect(out.travelMinutes).toBe(0);
    expect(out.totalMinutes).toBe(Math.ceil(DEFAULT_CALIBRATION.avg_contact_seconds / 60));
  });

  it("treats same-property consecutive stops as apartment time", () => {
    const stops = [
      { id: "a", lat: 33.9, lng: -80.85, neighborhood_id: "n1", address_line1: "100 Main St" },
      { id: "b", lat: 33.9, lng: -80.85, neighborhood_id: "n1", address_line1: "100 Main St" },
    ];
    const out = estimateMinutes(stops);
    expect(out.samePropertyPairs).toBe(1);
  });

  it("scales contact time with voter count", () => {
    const one = estimateMinutes([{ id: "a", lat: 0, lng: 0, voter_count: 1 }]);
    const four = estimateMinutes([{ id: "a", lat: 0, lng: 0, voter_count: 4 }]);
    expect(four.contactMinutes).toBeGreaterThan(one.contactMinutes);
  });

  it("adds parking buffer when spread exceeds 1 km", () => {
    const spread = estimateMinutes([
      { id: "a", lat: 0, lng: 0 },
      { id: "b", lat: 0.02, lng: 0.02 }, // ~3 km diagonal
    ]);
    expect(spread.parkingMinutes).toBeGreaterThan(0);
  });
});
