// Walk-time estimator — pure, testable. See SPEC § 1.3.
//
//   estimate_minutes(households[]) =
//       Σ travel_time(i, i+1)      // time between doors
//     + Σ contact_time(household)  // time at each door
//     + parking_buffer             // fixed, 0 if walking entirely
//
// Units: input distances in meters, output minutes (rounded up at the end).

import { haversineMeters } from "@/lib/geo/distance";
import { normalizeAddress as canonicalAddress } from "@/lib/addresses/normalize";

export interface EstimatorStop {
  id: string;
  lat: number;
  lng: number;
  neighborhood_id?: string | null;
  address_line1?: string | null;
  voter_count?: number;
  prior_come_back_later?: boolean;
  reknock_only?: boolean;
}

export interface EstimatorCalibration {
  avg_contact_seconds: number;
  avg_apartment_seconds: number;
  avg_walking_speed_kmh: number;
}

export const DEFAULT_CALIBRATION: EstimatorCalibration = {
  avg_contact_seconds: 240,
  avg_apartment_seconds: 30,
  avg_walking_speed_kmh: 5.0,
};

// Winding factor: real footpaths are longer than haversine great circle.
// Tuned from empirical Mapbox walking-direction results; dropped in v2 when
// we switch to real Directions API for the final route.
const WINDING_FACTOR = 1.35;

// Parking buffer kicks in when the bounding box is big enough that the
// volunteer is driving to the area (rather than walking from home).
const PARKING_BUFFER_MINUTES = 5;
const PARKING_TRIGGER_METERS = 1000;

export interface EstimateResult {
  totalMinutes: number;
  travelMinutes: number;
  contactMinutes: number;
  parkingMinutes: number;
  samePropertyPairs: number;
}

export function estimateMinutes(
  stops: EstimatorStop[],
  calibration: EstimatorCalibration = DEFAULT_CALIBRATION,
): EstimateResult {
  if (stops.length === 0) {
    return { totalMinutes: 0, travelMinutes: 0, contactMinutes: 0, parkingMinutes: 0, samePropertyPairs: 0 };
  }

  // 1. Travel time between consecutive stops.
  let travelSeconds = 0;
  let samePropertyPairs = 0;
  const walkingSpeedMps = (calibration.avg_walking_speed_kmh * 1000) / 3600;

  for (let i = 1; i < stops.length; i++) {
    const a = stops[i - 1];
    const b = stops[i];
    if (isSameProperty(a, b)) {
      travelSeconds += calibration.avg_apartment_seconds;
      samePropertyPairs++;
    } else {
      const meters = haversineMeters(a, b) * WINDING_FACTOR;
      travelSeconds += meters / walkingSpeedMps;
    }
  }

  // 2. Contact time at each stop.
  let contactSeconds = 0;
  for (const stop of stops) {
    contactSeconds += contactTime(stop, calibration);
  }

  // 3. Parking buffer if the cluster is big enough that you'd drive to it.
  const spreadMeters = boundingSpreadMeters(stops);
  const parkingMinutes = spreadMeters > PARKING_TRIGGER_METERS ? PARKING_BUFFER_MINUTES : 0;

  const travelMinutes = travelSeconds / 60;
  const contactMinutes = contactSeconds / 60;

  return {
    totalMinutes: Math.ceil(travelMinutes + contactMinutes + parkingMinutes),
    travelMinutes: round(travelMinutes),
    contactMinutes: round(contactMinutes),
    parkingMinutes,
    samePropertyPairs,
  };
}

function contactTime(stop: EstimatorStop, cal: EstimatorCalibration): number {
  let seconds = cal.avg_contact_seconds;
  // Each additional voter past the first adds half a minute — more people
  // means more to say, but only a bit more.
  const voterCount = Math.max(1, stop.voter_count ?? 1);
  seconds += (voterCount - 1) * 30;
  if (stop.prior_come_back_later) seconds *= 1.3;
  if (stop.reknock_only) seconds *= 0.5;
  return seconds;
}

function isSameProperty(a: EstimatorStop, b: EstimatorStop): boolean {
  if (!a.neighborhood_id || !b.neighborhood_id) return false;
  if (a.neighborhood_id !== b.neighborhood_id) return false;
  if (!a.address_line1 || !b.address_line1) return false;
  // Canonicalise so "123 Main St" and "123 Main Street" both resolve to one
  // building — same normaliser as the household match key.
  return canonicalAddress(a.address_line1) === canonicalAddress(b.address_line1);
}

function boundingSpreadMeters(stops: EstimatorStop[]): number {
  if (stops.length < 2) return 0;
  let minLat = stops[0].lat;
  let maxLat = stops[0].lat;
  let minLng = stops[0].lng;
  let maxLng = stops[0].lng;
  for (const s of stops) {
    if (s.lat < minLat) minLat = s.lat;
    if (s.lat > maxLat) maxLat = s.lat;
    if (s.lng < minLng) minLng = s.lng;
    if (s.lng > maxLng) maxLng = s.lng;
  }
  return haversineMeters({ lat: minLat, lng: minLng }, { lat: maxLat, lng: maxLng });
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}
