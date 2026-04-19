"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

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
const PACE_MULTIPLIER: Record<Pace, number> = { slow: 0.85, medium: 1.0, fast: 1.2 };
const PACE_COPY: Record<Pace, string> = {
  slow: "Slow — plenty of chat",
  medium: "Medium — steady pace",
  fast: "Fast — keep it moving",
};

export function PreviewWalkbook({ walkbook }: { walkbook: WalkbookPreview }) {
  const router = useRouter();
  const [stops, setStops] = useState<PreviewStop[] | null>(null);
  const [polyline, setPolyline] = useState<Array<[number, number]> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [pace, setPace] = useState<Pace>("medium");

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

      // Kick off a knock_sessions row so GPS pings and duration can be tracked.
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

      // Persist pace so admins can see the knocker's declared speed.
      await fetch("/api/knocker/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ speed_rating: pace, availability: "out_in_field" }),
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
      <h1 className="font-serif text-xl font-semibold text-navy-900">{walkbook.name}</h1>
      <p className="text-sm text-muted-foreground">
        {walkbook.household_count} doors
        {walkbook.estimated_duration_minutes != null
          ? ` · est ${walkbook.estimated_duration_minutes} min`
          : ""}
      </p>

      {loading ? <p className="mt-4 text-sm text-muted-foreground">Loading route…</p> : null}
      {error ? (
        <p className="mt-4 rounded bg-crimson/10 px-3 py-2 text-xs text-crimson">{error}</p>
      ) : null}

      {stops ? (
        <>
          <div className="mt-4 rounded-md border border-navy-100 bg-navy-50/50 p-3 text-xs text-navy-700">
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
                <span className="text-navy-900">{s.address || `${s.lat.toFixed(5)}, ${s.lng.toFixed(5)}`}</span>
              </li>
            ))}
          </ol>
        </>
      ) : null}

      <div className="mt-5 rounded-md border border-navy-100 bg-white p-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-navy-700">Your pace today</p>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {(Object.keys(PACE_COPY) as Pace[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPace(p)}
              className={`rounded-md border p-2 text-xs ${
                pace === p
                  ? "border-navy-900 bg-navy-900 text-white"
                  : "border-navy-200 bg-white text-navy-700"
              }`}
            >
              {PACE_COPY[p]}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Affects your estimated finish time; you can change it later.
        </p>
      </div>

      <div className="mt-5 flex gap-2">
        <Button onClick={start} disabled={starting || !stops || stops.length === 0} variant="accent">
          {starting ? "Starting…" : "Start knock session"}
        </Button>
        <Button variant="outline" onClick={() => router.back()}>
          Back
        </Button>
      </div>
    </div>
  );
}
