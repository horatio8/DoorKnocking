"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { formatWalkbookName } from "@/lib/walkbooks/display-name";

interface PreviewStop {
  id: string;
  lat: number;
  lng: number;
  address: string;
}

interface WalkbookPreview {
  id: string;
  name: string;
  description: string;
  household_count: number;
  estimated_duration_minutes: number | null;
  centroid: { lat: number | null; lng: number | null };
}

type Pace = "slow" | "medium" | "fast";
type Travel = "walking" | "driving";

const PACE_MULTIPLIER: Record<Pace, number> = { slow: 0.85, medium: 1.0, fast: 1.2 };
const PACE_COPY: Record<Pace, string> = {
  slow: "Slow",
  medium: "Medium",
  fast: "Fast",
};
const PACE_HINT: Record<Pace, string> = {
  slow: "Plenty of chat",
  medium: "Steady pace",
  fast: "Keep it moving",
};
const TRAVEL_COPY: Record<Travel, string> = { walking: "Walking", driving: "Driving" };
const TRAVEL_HINT: Record<Travel, string> = {
  walking: "Dense turf",
  driving: "Rural / spread out",
};

export function PreviewWalkbook({ walkbook }: { walkbook: WalkbookPreview }) {
  const router = useRouter();
  const [stops, setStops] = useState<PreviewStop[] | null>(null);
  const [polyline, setPolyline] = useState<Array<[number, number]> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [pace, setPace] = useState<Pace>("medium");
  const [travel, setTravel] = useState<Travel>("walking");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/walkbooks/${walkbook.id}/route-polyline`);
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? `${res.status}`);
        if (!cancelled) {
          setStops(body.stops as PreviewStop[]);
          setPolyline((body.polyline as Array<[number, number]> | null) ?? null);
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [walkbook.id]);

  async function start() {
    setStarting(true);
    try {
      const assignRes = await fetch(`/api/walkbooks/${walkbook.id}/assign`, { method: "POST" });
      const assignBody = await assignRes.json();
      if (!assignRes.ok) throw new Error(assignBody.error ?? `${assignRes.status}`);

      const sessRes = await fetch("/api/knocker/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walkbook_id: walkbook.id,
          pace_multiplier: PACE_MULTIPLIER[pace],
        }),
      });
      const sessBody = await sessRes.json().catch(() => ({}));
      if (!sessRes.ok) throw new Error(sessBody.error ?? `${sessRes.status}`);

      // Persist pace so admins can see the knocker's declared plan. (Travel
      // mode is captured as local session context — the profile endpoint
      // doesn't store it yet; keep it client-side until we add that column.)
      await fetch("/api/knocker/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          speed_rating: pace,
          availability: "out_in_field",
        }),
      }).catch(() => {});

      router.push(`/app/map?walkbook=${walkbook.id}`);
    } catch (e) {
      setError((e as Error).message);
      setStarting(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      <p className="text-xs uppercase tracking-widest text-navy-500">Preview</p>
      <h1 className="font-serif text-xl font-semibold text-navy-900">
        {formatWalkbookName(walkbook.name)}
      </h1>
      <p className="text-sm text-muted-foreground">
        {walkbook.household_count} doors
        {walkbook.estimated_duration_minutes != null
          ? ` · est ${walkbook.estimated_duration_minutes} min`
          : ""}
      </p>

      {/* Start-plan panel — moved above the stop list so the knocker makes
          the pace / travel decision before scanning the route. */}
      <section className="mt-4 rounded-lg border-2 border-navy-100 bg-white p-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-navy-700">
          Your plan today
        </p>

        <p className="mt-3 text-xs font-medium text-navy-600">How are you getting around?</p>
        <div className="mt-1.5 grid grid-cols-2 gap-2">
          {(Object.keys(TRAVEL_COPY) as Travel[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTravel(t)}
              className={`flex min-h-[64px] flex-col items-start justify-center rounded-xl border-2 p-3 text-left transition active:scale-[0.98] ${
                travel === t
                  ? "border-navy-900 bg-navy-900 text-white"
                  : "border-navy-200 bg-white text-navy-900"
              }`}
            >
              <span className="text-sm font-semibold">{TRAVEL_COPY[t]}</span>
              <span
                className={`mt-0.5 text-[11px] ${
                  travel === t ? "text-white/70" : "text-muted-foreground"
                }`}
              >
                {TRAVEL_HINT[t]}
              </span>
            </button>
          ))}
        </div>

        <p className="mt-4 text-xs font-medium text-navy-600">Your pace</p>
        <div className="mt-1.5 grid grid-cols-3 gap-2">
          {(Object.keys(PACE_COPY) as Pace[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPace(p)}
              className={`flex min-h-[64px] flex-col items-center justify-center rounded-xl border-2 p-2 text-center transition active:scale-[0.98] ${
                pace === p
                  ? "border-navy-900 bg-navy-900 text-white"
                  : "border-navy-200 bg-white text-navy-900"
              }`}
            >
              <span className="text-sm font-semibold">{PACE_COPY[p]}</span>
              <span
                className={`mt-0.5 text-[11px] ${
                  pace === p ? "text-white/70" : "text-muted-foreground"
                }`}
              >
                {PACE_HINT[p]}
              </span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Both settings tune the estimated finish time. Change them later from your profile.
        </p>
      </section>

      {/* Sticky primary action so the knocker doesn't have to scroll past the
          stop list to hit Start. Back stays inline above. */}
      <div className="mt-4 flex gap-2">
        <Button variant="outline" onClick={() => router.back()}>
          Back
        </Button>
        <Button
          onClick={start}
          disabled={starting || !stops || stops.length === 0}
          variant="accent"
          className="flex-1"
        >
          {starting ? "Starting…" : "Start knock session"}
        </Button>
      </div>

      {loading ? <p className="mt-4 text-sm text-muted-foreground">Loading route…</p> : null}
      {error ? (
        <p className="mt-4 rounded bg-crimson/10 px-3 py-2 text-xs text-crimson">{error}</p>
      ) : null}

      {stops ? (
        <>
          <div className="mt-5 rounded-md border border-navy-100 bg-navy-50/50 p-3 text-xs text-navy-700">
            {polyline
              ? `Route optimized via Mapbox walking directions · ${polyline.length} waypoints`
              : "Route shown in straight-line order (Mapbox directions unavailable — will still work in the field)"}
          </div>

          <ol className="mt-3 space-y-1 text-sm">
            {stops.map((s, i) => (
              <li key={s.id} className="flex gap-2 rounded-md border border-border bg-white p-2">
                <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-navy-900 text-[11px] font-semibold text-white">
                  {i + 1}
                </span>
                <span className="text-navy-900">
                  {s.address || `${s.lat.toFixed(5)}, ${s.lng.toFixed(5)}`}
                </span>
              </li>
            ))}
          </ol>
        </>
      ) : null}
    </div>
  );
}
