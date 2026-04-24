// Unified geocoding entry point.
//   - Bulk path: Census batch API (1 HTTP call, up to 10k rows, free).
//   - Per-row fallback: Mapbox (for the 2-5% of addresses Census misses).
//
// Callers should prefer `geocodeBatch` whenever they have N > 5 addresses —
// it's dramatically faster and avoids Mapbox quota for addresses Census
// can handle. `geocodeAddress` stays available for one-off calls.

import { geocodeAddress as mapboxGeocode, type GeocodeResult } from "./mapbox";
import { censusGeocodeBatch, censusGeocodeOne, type BatchAddressInput } from "./census";

export type { GeocodeResult } from "./mapbox";

export interface BatchInput extends BatchAddressInput {
  // Full comma-joined address used for the Mapbox fallback call — lets
  // the fallback succeed even when the per-field split was noisy.
  fallbackAddress?: string;
}

export interface BatchResult {
  byId: Map<string, GeocodeResult>;
  missed: string[]; // caller-provided ids with no geocode result after fallback
  censusHits: number;
  mapboxHits: number;
  mapboxSkipped: boolean; // true if Mapbox fallback was unavailable
}

// Try Census for everything; fall back to Mapbox for the rows Census
// couldn't match. Concurrency capped per-batch on the Mapbox side so we
// don't hammer it.
export async function geocodeBatch(inputs: BatchInput[]): Promise<BatchResult> {
  const byId = await censusGeocodeBatch(inputs);
  const censusHits = byId.size;
  const misses = inputs.filter((r) => !byId.has(r.id));
  let mapboxHits = 0;
  let mapboxSkipped = false;
  if (misses.length > 0) {
    const MAPBOX_CONCURRENCY = 10;
    try {
      // Probe Mapbox with the first miss — if it throws (e.g. no token),
      // bail on the whole fallback rather than spawning N throwing calls.
      const probeAddr = buildAddress(misses[0]);
      const probe = await mapboxGeocode(probeAddr);
      if (probe) {
        byId.set(misses[0].id, probe);
        mapboxHits += 1;
      }
      const remaining = misses.slice(1);
      for (let i = 0; i < remaining.length; i += MAPBOX_CONCURRENCY) {
        const chunk = remaining.slice(i, i + MAPBOX_CONCURRENCY);
        const results = await Promise.all(
          chunk.map((r) => mapboxGeocode(buildAddress(r)).catch(() => null)),
        );
        results.forEach((res, idx) => {
          if (res) {
            byId.set(chunk[idx].id, res);
            mapboxHits += 1;
          }
        });
      }
    } catch {
      // Mapbox token missing or totally unreachable — leave missed rows
      // unresolved. Caller can decide whether that's fatal.
      mapboxSkipped = true;
    }
  }
  const missed = inputs.filter((r) => !byId.has(r.id)).map((r) => r.id);
  return { byId, missed, censusHits, mapboxHits, mapboxSkipped };
}

// One-off single-address path — used by ad-hoc callers. Census first,
// Mapbox on miss (if configured).
export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const census = await censusGeocodeOne(address);
  if (census) return census;
  try {
    return await mapboxGeocode(address);
  } catch {
    return null;
  }
}

function buildAddress(r: BatchInput): string {
  if (r.fallbackAddress) return r.fallbackAddress;
  return [r.street, r.city, r.state, r.zip].filter(Boolean).join(", ");
}
