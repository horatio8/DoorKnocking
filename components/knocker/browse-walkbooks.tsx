"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface BrowseItem {
  id: string;
  name: string;
  description: string | null;
  kind: string;
  estimatedMinutes: number;
  doorsRemaining: number;
  doorsTotal: number;
  completion: number;
  efficiency: number;
  distanceMeters: number | null;
  activeAssignee: { user_id: string; full_name: string | null } | null;
  gapMinutes: number;
}

const BUDGETS = [30, 60, 90, 120];

export function BrowseWalkbooks({ districtId }: { districtId: string }) {
  const [budget, setBudget] = useState(90);
  const [q, setQ] = useState("");
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(null);
  const [items, setItems] = useState<BrowseItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setGeo(null),
      { maximumAge: 60_000, timeout: 8000 },
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setBusy(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          districtId,
          budgetMinutes: String(budget),
        });
        if (geo) {
          params.set("lat", String(geo.lat));
          params.set("lng", String(geo.lng));
        }
        if (q) params.set("q", q);
        const res = await fetch(`/api/walkbooks/browse?${params.toString()}`);
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? `${res.status}`);
        if (!cancelled) setItems(body.walkbooks as BrowseItem[]);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setBusy(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [districtId, budget, geo, q]);

  const ranked = useMemo(() => items ?? [], [items]);

  return (
    <div className="h-full overflow-y-auto p-4">
      <h1 className="font-serif text-2xl font-semibold text-navy-900">Pick a walkbook</h1>
      <p className="text-sm text-muted-foreground">
        Choose how much time you have. We&apos;ll rank walkbooks that fit.
      </p>

      <div className="mt-4 space-y-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-navy-700">Time budget</p>
          <div className="mt-1 flex flex-wrap gap-2">
            {BUDGETS.map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => setBudget(b)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
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

        <input
          type="search"
          placeholder="Search by name"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full rounded border border-navy-200 px-2 py-1 text-sm"
        />

        <p className="text-xs text-muted-foreground">
          {geo ? "Sorted by fit, then doors remaining, then distance from you." : "Enable location for distance sorting."}
        </p>
      </div>

      {busy && !items ? <p className="mt-4 text-sm text-muted-foreground">Loading…</p> : null}
      {error ? (
        <p className="mt-4 rounded bg-crimson/10 px-3 py-2 text-xs text-crimson">{error}</p>
      ) : null}

      <ul className="mt-4 space-y-2">
        {ranked.map((w) => (
          <li key={w.id}>
            <Link
              href={`/app/walkbooks/${w.id}/preview?budget=${budget}`}
              className="block rounded-md border border-border bg-white p-3 hover:border-navy-200"
            >
              <div className="flex items-baseline justify-between">
                <p className="font-medium text-navy-900">{w.name}</p>
                <span className="text-xs text-muted-foreground">{w.estimatedMinutes}m est</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {w.doorsRemaining}/{w.doorsTotal} doors remaining
                {w.completion > 0 ? ` · ${Math.round(w.completion * 100)}% done` : ""}
                {w.distanceMeters != null
                  ? ` · ${w.distanceMeters < 1000 ? `${Math.round(w.distanceMeters)}m` : `${(w.distanceMeters / 1000).toFixed(1)}km`} away`
                  : ""}
              </p>
              {w.activeAssignee ? (
                <p className="mt-1 text-[11px] text-amber-700">
                  In progress by {w.activeAssignee.full_name ?? "another knocker"} — you can still
                  pick it up (soft lock).
                </p>
              ) : null}
            </Link>
          </li>
        ))}
        {ranked.length === 0 && !busy ? (
          <li className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
            No walkbooks match. Try a different time budget, or ask your admin to generate new ones.
          </li>
        ) : null}
      </ul>

      <div className="mt-6 rounded-md border border-navy-100 bg-navy-50/50 p-3 text-xs text-navy-700">
        Want to walk from where you&apos;re standing right now?{" "}
        <Link href="/app/walkbooks/dynamic" className="underline font-medium">
          Walk from here →
        </Link>
      </div>
    </div>
  );
}
