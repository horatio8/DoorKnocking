// US Census Geocoder — free, unlimited, rooftop-accurate for US addresses.
// No API key. Supports a batch endpoint that accepts up to 10,000 addresses
// in a single multipart POST and returns CSV back in seconds. Docs:
// https://geocoding.geo.census.gov/geocoder/Geocoding_Services_API.pdf
//
// Primary geocoder for this app. Mapbox stays as a fallback for the
// addresses Census misses (rural edge cases, partial matches, international
// if we ever ship beyond the US).

import type { GeocodeResult } from "./mapbox";

const CENSUS_SINGLE_URL = "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress";
const CENSUS_BATCH_URL = "https://geocoding.geo.census.gov/geocoder/locations/addressbatch";
const BENCHMARK = "Public_AR_Current";

// ============================================================
// Single-address geocode. Good for small batches (< 20) and ad-hoc
// calls. For bulk imports prefer batchGeocode below.
// ============================================================
export async function censusGeocodeOne(address: string): Promise<GeocodeResult | null> {
  const url = `${CENSUS_SINGLE_URL}?address=${encodeURIComponent(
    address,
  )}&benchmark=${BENCHMARK}&format=json`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      result?: { addressMatches?: Array<{ coordinates: { x: number; y: number }; matchedAddress: string }> };
    };
    const match = body.result?.addressMatches?.[0];
    if (!match) return null;
    return {
      lat: Number(match.coordinates.y),
      lng: Number(match.coordinates.x),
      precision: "rooftop",
      formatted: match.matchedAddress,
    };
  } catch {
    return null;
  }
}

// ============================================================
// Batch geocode — one HTTP call handles up to 10k addresses. Way
// faster than sequential single calls for bulk imports. Returns a map
// keyed by the caller-provided id so you can correlate results back to
// your rows.
//
// Census requires a CSV upload shaped as:
//   id,street,city,state,zip
// The "id" can be anything — we echo it back on each result row.
// ============================================================
export interface BatchAddressInput {
  id: string;        // caller's row id; returned in the output for correlation
  street: string;
  city: string;
  state: string;
  zip: string;
}

export async function censusGeocodeBatch(
  inputs: BatchAddressInput[],
): Promise<Map<string, GeocodeResult>> {
  if (inputs.length === 0) return new Map();
  // Census caps each POST at 10k — chunk if the caller sent more.
  const out = new Map<string, GeocodeResult>();
  for (let i = 0; i < inputs.length; i += 10_000) {
    const slice = inputs.slice(i, i + 10_000);
    const csv = slice
      .map((r) =>
        [csvCell(r.id), csvCell(r.street), csvCell(r.city), csvCell(r.state), csvCell(r.zip)].join(","),
      )
      .join("\n");
    const form = new FormData();
    form.set("benchmark", BENCHMARK);
    form.set("addressFile", new Blob([csv], { type: "text/csv" }), "addresses.csv");
    let res: Response;
    try {
      res = await fetch(CENSUS_BATCH_URL, { method: "POST", body: form });
    } catch {
      // Network blip — let the caller fall back per-row to Mapbox.
      continue;
    }
    if (!res.ok) continue;
    const text = await res.text();
    // Response shape (no header row): id,raw,match_status,match_type,
    //                                 matched_address,lng_lat,tigerlineid,side
    // Example match row:
    //   "123","123 Main St, City, ST, 12345","Match","Exact","...","-80.12,35.45",...
    // Non-match rows have match_status="No_Match" and lng_lat blank.
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim()) continue;
      const cells = parseCsvRow(line);
      if (cells.length < 6) continue;
      const [id, , matchStatus, , matchedAddress, lngLat] = cells;
      if (matchStatus !== "Match" && matchStatus !== "Tie") continue;
      const [lngRaw, latRaw] = (lngLat ?? "").split(",");
      const lng = Number(lngRaw);
      const lat = Number(latRaw);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      out.set(id, { lat, lng, precision: "rooftop", formatted: matchedAddress ?? "" });
    }
  }
  return out;
}

// Minimal CSV quoting for the request body — commas/quotes/newlines get
// the double-quote treatment so Census' parser takes it literally.
function csvCell(v: string): string {
  const s = (v ?? "").replace(/\s+/g, " ").trim();
  if (/[,"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// Tolerant CSV row parser for the Census response. Handles quoted fields
// (including embedded commas) but doesn't try to deal with multi-line
// quoted values because Census output is single-line per row.
function parseCsvRow(line: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else {
      if (c === ",") {
        cells.push(cur);
        cur = "";
      } else if (c === '"') {
        inQuotes = true;
      } else {
        cur += c;
      }
    }
  }
  cells.push(cur);
  return cells;
}
