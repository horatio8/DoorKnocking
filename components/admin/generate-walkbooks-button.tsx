"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WalkbookResult {
  index: number;
  households: number;
  estimatedMinutes: number;
  detail: { travelMinutes: number; contactMinutes: number; parkingMinutes: number };
}

const DURATION_OPTIONS = [30, 60, 90, 120];

interface DistrictOption {
  id: string;
  name: string;
  slug?: string;
}

export function GenerateWalkbooksButton({
  districts,
}: {
  districts: DistrictOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selectedDistrictId, setSelectedDistrictId] = useState(districts[0]?.id ?? "");
  const [duration, setDuration] = useState(90);
  const [priorityOnly, setPriorityOnly] = useState(false);
  const [excludeContacted, setExcludeContacted] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    created: number;
    preserved: number;
    walkbooks: WalkbookResult[];
    durationMs: number;
  } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function run() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/walkbooks/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          districtId: selectedDistrictId,
          targetDurationMinutes: duration,
          priorityOnly,
          excludeContacted,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `Generate failed: ${res.status}`);
      setResult(body);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <Button variant="accent" onClick={() => setOpen((v) => !v)}>
        <Sparkles className="mr-1.5 h-4 w-4" />
        Generate walkbooks
      </Button>

      {open ? (
        <div className="absolute right-0 top-full z-30 mt-2 w-[22rem] rounded-lg border border-border bg-white p-4 shadow-xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-navy-900">Generate walkbooks</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Time-budgeted clusters of households, fitted to the walk.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-navy-400 hover:text-navy-700"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {districts.length > 1 ? (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-navy-500">
                  District
                </p>
                <select
                  value={selectedDistrictId}
                  onChange={(e) => setSelectedDistrictId(e.target.value)}
                  className="mt-1.5 w-full rounded-md border border-navy-200 bg-white px-2 py-2 text-sm"
                >
                  {districts.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-navy-500">
                Target duration per walkbook
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {DURATION_OPTIONS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDuration(d)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                      duration === d
                        ? "border-navy-900 bg-navy-900 text-white"
                        : "border-navy-200 bg-white text-navy-700 hover:bg-navy-50"
                    }`}
                  >
                    {d} min
                  </button>
                ))}
                <input
                  type="number"
                  min={15}
                  max={240}
                  step={5}
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="w-16 rounded-full border border-navy-200 px-2 py-1 text-center text-xs"
                  aria-label="Custom duration"
                />
              </div>
            </div>

            <label className="flex items-start gap-2 text-xs text-navy-700">
              <input
                type="checkbox"
                checked={excludeContacted}
                onChange={(e) => setExcludeContacted(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                Skip households already knocked
                <span className="block text-[11px] text-muted-foreground">
                  Avoids regenerating work that&apos;s already done.
                </span>
              </span>
            </label>

            <label className="flex items-start gap-2 text-xs text-navy-700">
              <input
                type="checkbox"
                checked={priorityOnly}
                onChange={(e) => setPriorityOnly(e.target.checked)}
                className="mt-0.5"
              />
              <span>Priority voters only</span>
            </label>

            <p className="text-[11px] text-muted-foreground">
              Walkbooks with ≥20% completion and custom walkbooks are preserved.
            </p>

            <div className="flex items-center gap-2 pt-1">
              <Button
                onClick={run}
                disabled={busy || !selectedDistrictId}
                variant="accent"
                className="flex-1"
              >
                {busy ? "Generating…" : "Run"}
              </Button>
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
                Cancel
              </Button>
            </div>

            {error ? (
              <p className="rounded bg-crimson/10 px-3 py-2 text-xs text-crimson">{error}</p>
            ) : null}

            {result ? (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
                <p className="font-medium">
                  Created {result.created} walkbook{result.created === 1 ? "" : "s"}
                  {result.preserved > 0 ? `, preserved ${result.preserved}` : ""} in{" "}
                  {Math.round(result.durationMs / 100) / 10}s.
                </p>
                <ul className="mt-2 max-h-40 space-y-0.5 overflow-auto">
                  {result.walkbooks.map((w) => (
                    <li key={w.index}>
                      #{w.index + 1}: {w.households} doors · ~{w.estimatedMinutes}m
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
