"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { formatWalkbookName } from "@/lib/walkbooks/display-name";
import { PageNav } from "@/components/knocker/page-nav";

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
  assignedToYou: boolean;
  gapMinutes: number;
}

// Four preset time budgets shown as big thumb-friendly chips, plus an explicit
// "Custom" chip that reveals the numeric input on tap. "Custom" exists to
// avoid hiding the input behind a long-press — it's discoverable and the
// numpad opens directly.
const BUDGETS = [30, 60, 90, 120];
const FAR_THRESHOLD_METERS = 5000;

type SortMode = "fit" | "closest";

export function BrowseWalkbooks({ districtId }: { districtId: string }) {
  const [budget, setBudget] = useState(90);
  const [customOpen, setCustomOpen] = useState(false);
  const [q, setQ] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(null);
  const [items, setItems] = useState<BrowseItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sort, setSort] = useState<SortMode>("fit");

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

  const { assigned, suggested } = useMemo(() => {
    const all = items ?? [];
    const assigned = all.filter((w) => w.assignedToYou);
    let rest = all.filter((w) => !w.assignedToYou);
    if (sort === "closest") {
      rest = [...rest].sort((a, b) => {
        const ad = a.distanceMeters ?? Infinity;
        const bd = b.distanceMeters ?? Infinity;
        if (ad !== bd) return ad - bd;
        return b.doorsRemaining - a.doorsRemaining;
      });
    }
    return { assigned, suggested: rest };
  }, [items, sort]);

  // Switching the sort to "Closest" tries to refresh GPS — same move the
  // retired "Find closest" button used to do, folded in so there's one
  // fewer control on the screen.
  async function onSort(next: SortMode) {
    setSort(next);
    if (next !== "closest" || !("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => void 0,
      { maximumAge: 0, timeout: 10000, enableHighAccuracy: true },
    );
  }

  function toggleSearch() {
    const next = !searchOpen;
    setSearchOpen(next);
    if (!next) setQ("");
    // Focus input on open so the keyboard lifts straight away.
    if (next) setTimeout(() => searchRef.current?.focus(), 30);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-navy-900">Pick a walkbook</h1>
          <p className="text-sm text-muted-foreground">
            {assigned.length > 0
              ? "You've got work waiting."
              : "How much time do you have?"}
          </p>
        </div>
        <button
          type="button"
          onClick={toggleSearch}
          aria-label={searchOpen ? "Close search" : "Search walkbooks by name"}
          className={`flex h-10 w-10 flex-none items-center justify-center rounded-full border ${
            searchOpen
              ? "border-navy-900 bg-navy-900 text-white"
              : "border-navy-200 bg-white text-navy-700"
          }`}
        >
          <Search className="h-4 w-4" />
        </button>
      </div>

      {searchOpen ? (
        <input
          ref={searchRef}
          type="search"
          placeholder="Search by name"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="mt-3 w-full rounded-md border border-navy-200 bg-white px-3 py-2 text-sm"
        />
      ) : null}

      {/* Time budget — big thumb-sized chips, 4 presets + Custom */}
      <div className="mt-4">
        <div className="grid grid-cols-5 gap-1.5">
          {BUDGETS.map((b) => {
            const active = !customOpen && budget === b;
            const label = b < 60 ? `${b}m` : `${b / 60}h`;
            return (
              <button
                key={b}
                type="button"
                onClick={() => {
                  setCustomOpen(false);
                  setBudget(b);
                }}
                className={`flex min-h-[56px] items-center justify-center rounded-xl border-2 text-base font-semibold transition active:scale-[0.97] ${
                  active
                    ? "border-navy-900 bg-navy-900 text-white"
                    : "border-navy-200 bg-white text-navy-900"
                }`}
              >
                {label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setCustomOpen((v) => !v)}
            className={`flex min-h-[56px] items-center justify-center rounded-xl border-2 text-sm font-semibold transition active:scale-[0.97] ${
              customOpen
                ? "border-navy-900 bg-navy-900 text-white"
                : "border-navy-200 bg-white text-navy-900"
            }`}
          >
            Custom
          </button>
        </div>
        {customOpen ? (
          <div className="mt-2 flex items-center gap-2">
            <input
              type="text"
              inputMode="decimal"
              pattern="[0-9.]*"
              value={(budget / 60).toString()}
              onChange={(e) => {
                const raw = e.target.value.replace(/[^0-9.]/g, "");
                const hours = Number(raw) || 0;
                setBudget(Math.round(hours * 60));
              }}
              className="h-12 flex-1 rounded-xl border-2 border-navy-200 bg-white px-3 text-center text-lg font-semibold text-navy-900"
              aria-label="Custom hours"
            />
            <span className="text-sm font-medium text-muted-foreground">hours</span>
          </div>
        ) : null}
      </div>

      {/* Sort — two big pills. Closest auto-requests GPS on tap. */}
      <div className="mt-3 grid grid-cols-2 gap-1.5">
        {(["fit", "closest"] as const).map((mode) => {
          const active = sort === mode;
          return (
            <button
              key={mode}
              type="button"
              onClick={() => onSort(mode)}
              className={`min-h-[44px] rounded-xl border-2 text-sm font-semibold transition active:scale-[0.97] ${
                active
                  ? "border-navy-900 bg-navy-900 text-white"
                  : "border-navy-200 bg-white text-navy-700"
              }`}
            >
              {mode === "fit" ? "Best fit for me" : "Closest to me"}
            </button>
          );
        })}
      </div>

      {busy && !items ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
      ) : null}
      {error ? (
        <p className="mt-4 rounded bg-crimson/10 px-3 py-2 text-xs text-crimson">{error}</p>
      ) : null}

      {assigned.length > 0 ? (
        <section className="mt-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-emerald-700">
            Assigned to you
          </p>
          <ul className="space-y-2">
            {assigned.map((w) => (
              <WalkbookCard key={w.id} w={w} budget={budget} assigned />
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-5">
        {assigned.length > 0 ? (
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-navy-500">
            Other walkbooks
          </p>
        ) : null}
        <ul className="space-y-2">
          {suggested.map((w) => (
            <WalkbookCard key={w.id} w={w} budget={budget} />
          ))}
          {suggested.length === 0 && assigned.length === 0 && !busy ? (
            <li className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
              No walkbooks match. Try a different time budget.
            </li>
          ) : null}
        </ul>
      </section>

      <div className="mt-6 rounded-md border border-navy-100 bg-navy-50/50 p-3 text-xs text-navy-700">
        Walk from where you&apos;re standing right now?{" "}
        <Link href="/app/walkbooks/dynamic" className="underline font-medium">
          Walk from here →
        </Link>
      </div>
      </div>
      <PageNav
        prev={{ href: "/app/map", label: "Map" }}
        next={{ href: "/app/me", label: "Your profile" }}
      />
    </div>
  );
}

// Two-line card: title + estimate on the first line, doors + distance on the
// second. Distance turns oxblood when >5km; the old separate warning
// paragraph is gone because the red distance already carries the signal.
function WalkbookCard({
  w,
  budget,
  assigned,
}: {
  w: BrowseItem;
  budget: number;
  assigned?: boolean;
}) {
  const far = w.distanceMeters != null && w.distanceMeters > FAR_THRESHOLD_METERS;
  const distanceLabel =
    w.distanceMeters == null
      ? null
      : w.distanceMeters < 1000
        ? `${Math.round(w.distanceMeters)}m`
        : `${(w.distanceMeters / 1000).toFixed(1)}km`;

  return (
    <li>
      <Link
        href={`/app/walkbooks/${w.id}/preview?budget=${budget}`}
        className={`block rounded-xl border-2 bg-white p-4 transition active:scale-[0.995] ${
          assigned ? "border-emerald-300" : "border-navy-100 hover:border-navy-200"
        }`}
      >
        <div className="flex items-baseline justify-between gap-3">
          <p className="min-w-0 truncate text-base font-semibold text-navy-900">
            {formatWalkbookName(w.name)}
          </p>
          <span className="flex-none text-xs font-medium text-muted-foreground">
            ~{w.estimatedMinutes}m
          </span>
        </div>
        <p className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
          <span>
            {w.doorsRemaining}/{w.doorsTotal} doors
            {w.completion > 0 ? ` · ${Math.round(w.completion * 100)}% done` : ""}
          </span>
          {distanceLabel ? (
            <span className={far ? "font-semibold text-amber-700" : undefined}>
              · {distanceLabel} away{far ? " · far" : ""}
            </span>
          ) : null}
        </p>
      </Link>
    </li>
  );
}
