"use client";

import { useEffect, useMemo, useState } from "react";
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

interface SurveyChoice {
  id: string;
  name: string;
  pinned: boolean;
  source: "walkbook" | "district";
}

type Pace = "slow" | "medium" | "fast";
type Travel = "walking" | "driving";

const PACE_MULTIPLIER: Record<Pace, number> = { slow: 0.85, medium: 1.0, fast: 1.2 };
const PACE_COPY: Record<Pace, string> = { slow: "Slow", medium: "Medium", fast: "Fast" };
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

export function PreviewWalkbook({
  walkbook,
  surveyChoices = [],
}: {
  walkbook: WalkbookPreview;
  surveyChoices?: SurveyChoice[];
}) {
  const router = useRouter();
  const [stops, setStops] = useState<PreviewStop[] | null>(null);
  const [polyline, setPolyline] = useState<Array<[number, number]> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [pace, setPace] = useState<Pace>("medium");
  const [travel, setTravel] = useState<Travel>("walking");

  // Mount log — if this fires more than once during a single Start-session
  // attempt it means the page is remounting (the navigation came back).
  useEffect(() => {
    console.info("[preview] mounted for walkbook", walkbook.id, "at", new Date().toISOString());
  }, [walkbook.id]);

  // Auto-pick the pinned survey when one exists, otherwise the first
  // in the list (priority-ordered). Scripts live inside surveys now as
  // info screens, so there's no separate script picker.
  const pinnedSurvey = useMemo(() => surveyChoices.find((s) => s.pinned) ?? null, [surveyChoices]);
  const [surveyId, setSurveyId] = useState<string | null>(
    pinnedSurvey?.id ?? surveyChoices[0]?.id ?? null,
  );

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
    setError(null);
    try {
      console.info("[preview] Start knock session → assigning walkbook", walkbook.id);
      const assignRes = await fetch(`/api/walkbooks/${walkbook.id}/assign`, { method: "POST" });
      const assignBody = await assignRes.json().catch(() => ({}));
      if (!assignRes.ok) {
        console.warn("[preview] /assign failed", assignRes.status, assignBody);
        throw new Error(
          assignBody.error ?? `Couldn't claim the walkbook (${assignRes.status}).`,
        );
      }
      console.info("[preview] /assign ok", assignBody);

      // The session row captures what the volunteer picked at the door
      // so the household page can resolve the right survey + script.
      console.info("[preview] starting knock session");
      const sessRes = await fetch("/api/knocker/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walkbook_id: walkbook.id,
          pace_multiplier: PACE_MULTIPLIER[pace],
          chosen_survey_id: surveyId,
          chosen_script_id: null,
        }),
      });
      const sessBody = await sessRes.json().catch(() => ({}));
      if (!sessRes.ok) {
        console.warn("[preview] /session failed", sessRes.status, sessBody);
        throw new Error(
          sessBody.error ?? `Couldn't start your knock session (${sessRes.status}).`,
        );
      }
      console.info("[preview] /session ok", sessBody);

      // Fire-and-forget — profile updates mustn't block navigation.
      fetch("/api/knocker/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ speed_rating: pace, availability: "out_in_field" }),
      }).catch((err) => console.warn("[preview] profile patch failed (non-fatal)", err));

      const mapUrl = `/app/map?walkbook=${walkbook.id}`;
      console.info("[preview] navigating (hard) to", mapUrl);
      // Hard navigation on purpose. router.push() was exhibiting a loop
      // where the URL changed but some deploys bounced back to preview
      // under React's transition/cache — location.href forces a full
      // page load so the map page renders fresh.
      window.location.href = mapUrl;
    } catch (e) {
      console.error("[preview] Start knock session failed:", e);
      setError((e as Error).message || "Unknown error starting the session.");
      setStarting(false);
    }
  }

  const surveyLocked = pinnedSurvey != null && surveyChoices.length === 1;

  return (
    <div className="h-full overflow-y-auto p-4">
      {error ? (
        <div
          role="alert"
          className="mb-3 rounded-md border border-crimson/30 bg-crimson/10 px-3 py-2 text-sm text-crimson"
        >
          <p className="font-semibold">Couldn&rsquo;t start knocking</p>
          <p className="mt-0.5 text-xs">{error}</p>
        </div>
      ) : null}
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

      {/* Your plan today — travel + pace (unchanged). */}
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
                className={`mt-0.5 text-[11px] ${travel === t ? "text-white/70" : "text-muted-foreground"}`}
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
                className={`mt-0.5 text-[11px] ${pace === p ? "text-white/70" : "text-muted-foreground"}`}
              >
                {PACE_HINT[p]}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Which survey — shows nothing if none attached + no district default,
          a locked panel if pinned, or a radio picker if multiple available. */}
      {surveyChoices.length > 0 ? (
        <section className="mt-4 rounded-lg border-2 border-navy-100 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-navy-700">
            Survey{surveyLocked ? " · locked by admin" : ""}
          </p>
          {surveyLocked ? (
            <p className="mt-2 text-sm text-navy-900">{surveyChoices[0]!.name}</p>
          ) : (
            <div className="mt-2 grid gap-2">
              {surveyChoices.map((s) => (
                <label
                  key={s.id}
                  className={`flex cursor-pointer items-start gap-2 rounded-xl border-2 p-3 ${
                    surveyId === s.id
                      ? "border-navy-900 bg-navy-50"
                      : "border-navy-200 bg-white"
                  }`}
                >
                  <input
                    type="radio"
                    name="survey"
                    checked={surveyId === s.id}
                    onChange={() => setSurveyId(s.id)}
                    className="mt-1 accent-navy-900"
                  />
                  <span className="flex-1">
                    <span className="block text-sm font-semibold text-navy-900">{s.name}</span>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">
                      {s.source === "district" ? "District default" : "Walkbook attachment"}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </section>
      ) : null}

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
