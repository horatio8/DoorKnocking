"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const BUDGETS = [30, 60, 90, 120];

type Step = "locating" | "configure" | "generating" | "error";

export function WalkFromHere({ districtId }: { districtId: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("locating");
  const [error, setError] = useState<string | null>(null);
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(null);
  const [budget, setBudget] = useState(60);
  const [avoidCompleted, setAvoidCompleted] = useState(true);

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

  async function generate() {
    if (!geo) return;
    setStep("generating");
    setError(null);
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
      if (!res.ok) throw new Error(body.error ?? `${res.status}`);
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
                type="number"
                min={15}
                max={240}
                step={5}
                value={budget}
                onChange={(e) => setBudget(Number(e.target.value))}
                className="w-20 rounded border border-navy-200 px-2 py-1 text-xs"
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
