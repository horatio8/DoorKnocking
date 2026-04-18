"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface WalkbookResult {
  index: number;
  households: number;
  estimatedMinutes: number;
  detail: { travelMinutes: number; contactMinutes: number; parkingMinutes: number };
}

const DURATION_OPTIONS = [30, 60, 90, 120];

export function GenerateWalkbooksButton({ districtId }: { districtId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
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

  async function run() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/walkbooks/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          districtId,
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

  if (!open) {
    return (
      <Button variant="accent" onClick={() => setOpen(true)}>
        Generate walkbooks
      </Button>
    );
  }

  return (
    <div className="w-full max-w-xl space-y-3 rounded-md border border-navy-100 bg-white p-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-navy-700">
          Target duration per walkbook
        </p>
        <div className="mt-1 flex flex-wrap gap-2">
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
            className="w-20 rounded border border-navy-200 px-2 py-1 text-xs"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={excludeContacted}
          onChange={(e) => setExcludeContacted(e.target.checked)}
        />
        Exclude households already contacted
      </label>

      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={priorityOnly}
          onChange={(e) => setPriorityOnly(e.target.checked)}
        />
        Priority voters only
      </label>

      <p className="text-xs text-muted-foreground">
        Walkbooks with ≥20% completion are preserved (mid-campaign). Custom walkbooks are always
        preserved.
      </p>

      <div className="flex items-center gap-2">
        <Button onClick={run} disabled={busy} variant="accent">
          {busy ? "Generating…" : "Run"}
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        {error ? <span className="text-xs text-crimson">{error}</span> : null}
      </div>

      {result ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
          <p>
            Created {result.created} walkbook(s){result.preserved > 0 ? `, preserved ${result.preserved}` : ""}{" "}
            in {Math.round(result.durationMs / 100) / 10}s.
          </p>
          <ul className="mt-2 space-y-0.5">
            {result.walkbooks.map((w) => (
              <li key={w.index}>
                #{w.index + 1}: {w.households} doors · est {w.estimatedMinutes}m (
                {w.detail.travelMinutes}m walk + {w.detail.contactMinutes}m contact
                {w.detail.parkingMinutes > 0 ? ` + ${w.detail.parkingMinutes}m parking` : ""})
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
