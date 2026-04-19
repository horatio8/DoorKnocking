"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const BUDGETS = [30, 60, 90, 120];

// Average walking pace ~80 m/min (~5 km/h, urban with stops). Used to
// estimate "x minutes from you" when surfacing fallback walkbooks.
const WALKING_METERS_PER_MIN = 80;

type Step = "locating" | "configure" | "generating" | "error" | "fallback";

interface FallbackOption {
  id: string;
  name: string;
  distanceMeters: number;
  doorsRemaining: number;
  doorsTotal: number;
  estimatedMinutes: number;
}

export function WalkFromHere({ districtId }: { districtId: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("locating");
  const [error, setError] = useState<string | null>(null);
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(null);
  const [budget, setBudget] = useState(60);
  const [avoidCompleted, setAvoidCompleted] = useState(true);
  const [fallback, setFallback] = useState<FallbackOption | null>(null);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setStep("error");
      setError("Geolocation unavailable on this device. Use the browse flow instead.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setStep("configure");
      },
      (err) => {
        setStep("error");
        setError(`Couldn't get your location: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, []);

  async function findClosestWalkbook(): Promise<FallbackOption | null> {
    if (!geo) return null;
    const params = new URLSearchParams({
      districtId,
      budgetMinutes: "999",
      lat: String(geo.lat),
      lng: String(geo.lng),
    });
    const res = await fetch(`/api/walkbooks/browse?${params}`);
    if (!res.ok) return null;
    const body = (await res.json()) as {
      walkbooks: Array<{
        id: string;
        name: string;
        distanceMeters: number | null;
        doorsRemaining: number;
        doorsTotal: number;
        estimatedMinutes: number;
      }>;
    };
    const withDistance = body.walkbooks.filter((w) => w.distanceMeters != null);
    if (withDistance.length === 0) return null;
    withDistance.sort((a, b) => (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0));
    const w = withDistance[0]!;
    return {
      id: w.id,
      name: w.name,
      distanceMeters: w.distanceMeters!,
      doorsRemaining: w.doorsRemaining,
      doorsTotal: w.doorsTotal,
      estimatedMinutes: w.estimatedMinutes,
    };
  }

  async function generate() {
    if (!geo) return;
    setStep("generating");
    setError(null);
    setFallback(null);
    try {
      const res = await fetch("/api/walkbooks/dynamic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          districtId,
          lat: geo.lat,
          lng: geo.lng,
          budgetMinutes: budget,
          avoidCompleted,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        // No doors in range — fall back to "here's the closest walkbook" so the
        // knocker isn't dead-ended.
        const closest = await findClosestWalkbook();
        if (closest) {
          setFallback(closest);
          setStep("fallback");
          return;
        }
        throw new Error(body.error ?? `${res.status}`);
      }
      router.push(`/app/walkbooks/${body.walkbookId}/preview?budget=${budget}`);
    } catch (e) {
      setStep("error");
      setError((e as Error).message);
    }
  }

  return (
    <div className="flex h-full flex-col p-4">
      <p className="text-xs uppercase tracking-widest text-navy-500">Walk from here</p>
      <h1 className="font-serif text-2xl font-semibold text-navy-900">
        {step === "locating"
          ? "Finding you…"
          : step === "generating"
            ? "Building your route…"
            : step === "fallback"
              ? "Nothing in range — here's the closest"
              : "How much time?"}
      </h1>

      {step === "locating" ? (
        <p className="mt-3 text-sm text-muted-foreground">
          We need your GPS to pick the closest doors.
        </p>
      ) : null}

      {step === "configure" && geo ? (
        <div className="mt-4 space-y-4">
          <p className="text-xs text-muted-foreground">
            At {geo.lat.toFixed(4)}, {geo.lng.toFixed(4)}
          </p>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-navy-700">Time budget</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {BUDGETS.map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setBudget(b)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium ${
                    budget === b
                      ? "border-navy-900 bg-navy-900 text-white"
                      : "border-navy-200 bg-white text-navy-700"
                  }`}
                >
                  {b} min
                </button>
              ))}
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={budget}
                onChange={(e) =>
                  setBudget(Number(e.target.value.replace(/[^0-9]/g, "")) || 0)
                }
                className="w-20 rounded border border-navy-200 px-2 py-1 text-center text-sm"
                aria-label="Custom minutes"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={avoidCompleted}
              onChange={(e) => setAvoidCompleted(e.target.checked)}
            />
            Avoid houses I&apos;ve already knocked
          </label>

          <div className="flex gap-2">
            <Button onClick={generate} variant="accent">
              Generate walkbook
            </Button>
            <Button variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {step === "generating" ? (
        <p className="mt-3 text-sm text-muted-foreground">Picking the best doors near you…</p>
      ) : null}

      {step === "fallback" && fallback ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            No reachable doors within {budget}m of you. The closest walkbook we have is:
          </p>
          <div className="rounded-lg border border-navy-200 bg-white p-4">
            <p className="text-base font-semibold text-navy-900">{fallback.name}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatDistance(fallback.distanceMeters)} away · about{" "}
              {Math.max(1, Math.round(fallback.distanceMeters / WALKING_METERS_PER_MIN))} min walk
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {fallback.doorsRemaining}/{fallback.doorsTotal} doors remaining ·{" "}
              ~{fallback.estimatedMinutes}m to complete
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href={`/app/walkbooks/${fallback.id}/preview?budget=${budget}`}
                className="inline-flex items-center rounded-md bg-navy-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-navy-800"
              >
                Open it
              </Link>
              <Button
                variant="outline"
                onClick={() => {
                  setStep("configure");
                  setFallback(null);
                }}
              >
                Pick a different time
              </Button>
              <Link
                href="/app/walkbooks/browse"
                className="inline-flex items-center rounded-md border border-navy-200 bg-white px-3 py-1.5 text-sm font-medium text-navy-700 hover:bg-navy-50"
              >
                Browse all
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      {step === "error" ? (
        <div className="mt-4 space-y-2">
          <p className="rounded bg-crimson/10 px-3 py-2 text-xs text-crimson">{error}</p>
          <Button variant="outline" onClick={() => router.push("/app/walkbooks/browse")}>
            Back to browse
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}
