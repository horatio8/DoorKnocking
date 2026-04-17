// Mapbox helpers: geocoding (server-side only) + style constants.

import { serverEnv } from "@/lib/env";

export const MAPBOX_STYLE = "mapbox://styles/mapbox/streets-v12";
export const DEFAULT_ZOOM = 15;

export interface GeocodeResult {
  lat: number;
  lng: number;
  precision: "rooftop" | "street" | "postcode" | "region";
  formatted: string;
}

// Retry-aware forward geocode. Prefer rooftop precision; fall back to street.
export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const env = serverEnv();
  const token = env.mapboxSecretToken ?? process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) throw new Error("Mapbox token not configured");

  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
    address,
  )}.json?limit=1&access_token=${token}&types=address,postcode`;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        if (res.status === 429) {
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }
        return null;
      }
      const body = await res.json();
      const feature = body.features?.[0];
      if (!feature) return null;
      const [lng, lat] = feature.center;
      const precision: GeocodeResult["precision"] = feature.properties?.accuracy === "rooftop"
        ? "rooftop"
        : feature.place_type?.includes("address") ? "street"
        : feature.place_type?.includes("postcode") ? "postcode" : "region";
      return { lat, lng, precision, formatted: feature.place_name };
    } catch {
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  return null;
}
