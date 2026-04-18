"use client";

import { useState } from "react";
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

  if (!open) {
    return (
      <Button variant="accent" onClick={() => setOpen(true)}>
        <Sparkles className="mr-1.5 h-4 w-4" />
        Generate walkbooks
      </Button>
    );
  }

  return (
    <GenerateInlinePanel
      districts={districts}
      selectedDistrictId={selectedDistrictId}
      setSelectedDistrictId={setSelectedDistrictId}
      duration={duration}
      setDuration={setDuration}
      priorityOnly={priorityOnly}
      setPriorityOnly={setPriorityOnly}
      excludeContacted={excludeContacted}
      setExcludeContacted={setExcludeContacted}
      busy={busy}
      error={error}
      result={result}
      onRun={run}
      onClose={() => setOpen(false)}
    />
  );
}

interface PanelProps {
  districts: DistrictOption[];
  selectedDistrictId: string;
  setSelectedDistrictId: (id: string) => void;
  duration: number;
  setDuration: (n: number) => void;
  priorityOnly: boolean;
  setPriorityOnly: (b: boolean) => void;
  excludeContacted: boolean;
  setExcludeContacted: (b: boolean) => void;
  busy: boolean;
  error: string | null;
  result: {
    created: number;
    preserved: number;
    walkbooks: WalkbookResult[];
    durationMs: number;
  } | null;
  onRun: () => void;
  onClose: () => void;
}

// Renders inline at the parent's full width — when the page header puts this
// where the closed Button used to sit, it still respects flex sizing because
// the parent uses `flex-wrap`. The wide content forces a wrap and the panel
// occupies the full row beneath the title block.
function GenerateInlinePanel(p: PanelProps) {
  return (
    <div className="w-full rounded-lg border border-border bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-navy-900">
            <Sparkles className="h-4 w-4" /> Generate walkbooks
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Time-budgeted clusters of households, fitted to the walk.
          </p>
        </div>
        <button
          type="button"
          onClick={p.onClose}
          className="text-navy-400 hover:text-navy-700"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          {p.districts.length > 1 ? (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-navy-500">
                District
              </p>
              <select
                value={p.selectedDistrictId}
                onChange={(e) => p.setSelectedDistrictId(e.target.value)}
                className="mt-1.5 w-full rounded-md border border-navy-200 bg-white px-2 py-2 text-sm"
              >
                {p.districts.map((d) => (
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
                  onClick={() => p.setDuration(d)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    p.duration === d
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
                value={p.duration}
                onChange={(e) => p.setDuration(Number(e.target.value))}
                className="w-16 rounded-full border border-navy-200 px-2 py-1 text-center text-xs"
                aria-label="Custom duration"
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="flex items-start gap-2 text-xs text-navy-700">
            <input
              type="checkbox"
              checked={p.excludeContacted}
              onChange={(e) => p.setExcludeContacted(e.target.checked)}
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
              checked={p.priorityOnly}
              onChange={(e) => p.setPriorityOnly(e.target.checked)}
              className="mt-0.5"
            />
            <span>Priority voters only</span>
          </label>

          <p className="text-[11px] text-muted-foreground">
            Walkbooks with ≥20% completion and custom walkbooks are preserved.
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Button
          onClick={p.onRun}
          disabled={p.busy || !p.selectedDistrictId}
          variant="accent"
        >
          {p.busy ? "Generating…" : "Run"}
        </Button>
        <Button variant="ghost" onClick={p.onClose} disabled={p.busy}>
          Close
        </Button>
      </div>

      {p.error ? (
        <p className="mt-3 rounded bg-crimson/10 px-3 py-2 text-xs text-crimson">{p.error}</p>
      ) : null}

      {p.result ? (
        <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
          <p className="font-medium">
            Created {p.result.created} walkbook{p.result.created === 1 ? "" : "s"}
            {p.result.preserved > 0 ? `, preserved ${p.result.preserved}` : ""} in{" "}
            {Math.round(p.result.durationMs / 100) / 10}s. Refreshing the list now…
          </p>
        </div>
      ) : null}
    </div>
  );
}
