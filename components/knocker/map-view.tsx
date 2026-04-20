"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl, { type GeoJSONSource } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useRouter } from "next/navigation";
import { useFieldStore } from "@/lib/offline/store";
import { publicEnv } from "@/lib/env";
import {
  HOUSEHOLD_PIN_COLORS,
  HOUSEHOLD_STATUS_LABELS,
  type Household,
  type HouseholdStatus,
  type Walkbook,
} from "@/lib/types";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { computeBoundingBox, haversineMeters } from "@/lib/geo/distance";
import { walkbookColor, walkbookColorWithGrey } from "@/lib/walkbooks/color";
import { formatWalkbookName, walkbookPinLabel } from "@/lib/walkbooks/display-name";
import { Navigation } from "lucide-react";

mapboxgl.accessToken = publicEnv.mapboxToken;

interface WalkbookViz {
  id: string;
  name: string;
  stops: Array<{ lat: number; lng: number; order_index: number }>;
  anchor: { lat: number; lng: number } | null;
  household_count: number;
  estimated_duration_minutes: number | null;
  status: string;
}

interface MapViewProps {
  userId: string;
  districtId: string;
  households: Household[];
  walkbooks: Walkbook[];
  walkbookViz?: WalkbookViz[];
  myWalkbookIds?: string[];
  selfAssignedIds?: string[];
}

// Short labels so all six chips fit in a single row on phones without
// horizontal scrolling. Matches HOUSEHOLD_STATUS_LABELS order.
const STATUS_OPTIONS: HouseholdStatus[] = [
  "not_knocked",
  "no_answer",
  "come_back_later",
  "contacted",
  "refused",
  "mixed",
];
const SHORT_LABELS: Record<HouseholdStatus, string> = {
  not_knocked: "To knock",
  no_answer: "No answer",
  come_back_later: "Back later",
  contacted: "Contacted",
  refused: "Refused",
  mixed: "Mixed",
};

export function MapView({
  userId,
  districtId,
  households: initialHouseholds,
  walkbooks,
  walkbookViz = [],
  myWalkbookIds = [],
  selfAssignedIds = [],
}: MapViewProps) {
  const router = useRouter();
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [statusFilter, setStatusFilter] = useState<Set<HouseholdStatus>>(new Set(STATUS_OPTIONS));
  // Default to "my walkbooks" when the knocker has assignments — they're
  // almost always working their own turf, so showing the entire district on
  // open is noise. They can flip to "show all" from the toggle.
  const [myWalkbookOnly, setMyWalkbookOnly] = useState(myWalkbookIds.length > 0);
  // Tapping a pin or route isolates one walkbook on the map and pops the
  // bottom-sheet summary. Clearing the selection returns to the filtered
  // overview.
  const [selectedWalkbookId, setSelectedWalkbookId] = useState<string | null>(null);
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);

  const hydrate = useFieldStore((s) => s.hydrate);
  const households = useFieldStore((s) => s.households);

  useEffect(() => {
    hydrate({
      userId,
      districtId,
      households: initialHouseholds,
      voters: [],
      tags: [],
    });
  }, [userId, districtId, initialHouseholds, hydrate]);

  // Realtime subscription — keeps the map in sync with other knockers.
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel(`district-${districtId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "households", filter: `district_id=eq.${districtId}` },
        (payload: { new?: Household }) => {
          const row = payload.new;
          if (!row) return;
          const store = useFieldStore.getState();
          const existing = store.households.get(row.id);
          const next = new Map(store.households);
          next.set(row.id, { ...(existing ?? row), ...row });
          useFieldStore.setState({ households: next });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [districtId]);

  useEffect(() => {
    if (!navigator.geolocation) return;
    const watcher = navigator.geolocation.watchPosition(
      (pos) => setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => void 0,
      { enableHighAccuracy: true, maximumAge: 10_000 },
    );
    return () => navigator.geolocation.clearWatch(watcher);
  }, []);

  // Which walkbooks to show on the map. Precedence:
  //   selectedWalkbookId → just that one
  //   myWalkbookOnly     → only my assigned walkbooks
  //   otherwise          → everything
  const mineSet = useMemo(() => new Set(myWalkbookIds), [myWalkbookIds]);
  const selfAssignedSet = useMemo(() => new Set(selfAssignedIds), [selfAssignedIds]);
  const visibleWalkbooks = useMemo(() => {
    if (selectedWalkbookId) {
      return walkbookViz.filter((w) => w.id === selectedWalkbookId);
    }
    if (!myWalkbookOnly || mineSet.size === 0) return walkbookViz;
    return walkbookViz.filter((w) => mineSet.has(w.id));
  }, [walkbookViz, myWalkbookOnly, mineSet, selectedWalkbookId]);

  // Households to plot — filtered by status, narrowed to:
  //   selectedWalkbookId → households in that one walkbook only
  //   myWalkbookOnly     → households in any of my walkbooks
  //   otherwise          → all households in the district
  const visibleHouseholds = useMemo(() => {
    const inScope = new Set<string>();
    const scopedWalkbooks: typeof walkbookViz = selectedWalkbookId
      ? walkbookViz.filter((w) => w.id === selectedWalkbookId)
      : myWalkbookOnly && mineSet.size > 0
        ? walkbookViz.filter((w) => mineSet.has(w.id))
        : [];
    const scopedOn = selectedWalkbookId || (myWalkbookOnly && mineSet.size > 0);
    if (scopedOn) {
      const stopKeys = new Set<string>();
      for (const w of scopedWalkbooks) {
        for (const s of w.stops) stopKeys.add(`${s.lat.toFixed(5)}|${s.lng.toFixed(5)}`);
      }
      for (const h of Array.from(households.values())) {
        const key = `${Number(h.lat).toFixed(5)}|${Number(h.lng).toFixed(5)}`;
        if (stopKeys.has(key)) inScope.add(h.id);
      }
    }
    return Array.from(households.values()).filter((h) => {
      if (!statusFilter.has(h.status)) return false;
      if (scopedOn && !inScope.has(h.id)) return false;
      return true;
    });
  }, [households, statusFilter, myWalkbookOnly, mineSet, walkbookViz, selectedWalkbookId]);

  const householdFC = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: visibleHouseholds.map((h) => ({
        type: "Feature" as const,
        id: h.id,
        properties: {
          id: h.id,
          status: h.status,
          color: HOUSEHOLD_PIN_COLORS[h.status],
          address: h.address_line1,
        },
        geometry: { type: "Point" as const, coordinates: [Number(h.lng), Number(h.lat)] },
      })),
    }),
    [visibleHouseholds],
  );

  const walkbookLinesFC = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: visibleWalkbooks
        .filter((w) => w.stops.length >= 2)
        .map((w) => ({
          type: "Feature" as const,
          properties: {
            id: w.id,
            name: w.name,
            color: walkbookColorWithGrey(w.id, false),
            mine: mineSet.has(w.id),
          },
          geometry: {
            type: "LineString" as const,
            coordinates: w.stops.map((s) => [s.lng, s.lat] as [number, number]),
          },
        })),
    }),
    [visibleWalkbooks, mineSet],
  );

  // Init map — render walkbook route lines under the household dots. No
  // clustering; individual dots remain clickable at every zoom so knockers
  // can always tap a house.
  useEffect(() => {
    if (mapRef.current || !mapContainer.current) return;
    const bbox = computeBoundingBox(initialHouseholds.map((h) => ({ lat: h.lat, lng: h.lng })));
    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: bbox ? [(bbox.east + bbox.west) / 2, (bbox.north + bbox.south) / 2] : [-80.85, 33.93],
      zoom: 13,
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    map.on("load", () => {
      map.addSource("wb-lines", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "wb-lines",
        type: "line",
        source: "wb-lines",
        paint: {
          "line-color": ["get", "color"],
          "line-width": ["case", ["get", "mine"], 4, 2.5],
          "line-opacity": ["case", ["get", "mine"], 0.9, 0.55],
        },
        layout: { "line-cap": "round", "line-join": "round" },
      });

      map.addSource("households", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "household-points",
        type: "circle",
        source: "households",
        paint: {
          "circle-color": ["get", "color"],
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 3, 14, 6, 17, 9],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1.5,
        },
      });

      map.on("click", "household-points", (e) => {
        const id = (e.features?.[0]?.properties as { id?: string } | undefined)?.id;
        if (id) router.push(`/app/household/${id}`);
      });
      map.on("mouseenter", "household-points", () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", "household-points", () => (map.getCanvas().style.cursor = ""));
      map.on("mouseenter", "wb-lines", () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", "wb-lines", () => (map.getCanvas().style.cursor = ""));
    });
    mapRef.current = map;
    return () => map.remove();
  }, [initialHouseholds, router]);

  // Feed both sources whenever the memoised feature-collections change.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      (map.getSource("households") as GeoJSONSource | undefined)?.setData(householdFC);
      (map.getSource("wb-lines") as GeoJSONSource | undefined)?.setData(walkbookLinesFC);
    };
    if (map.isStyleLoaded()) apply();
    else map.once("load", apply);
  }, [householdFC, walkbookLinesFC]);

  // Clickable walkbook pins — one <mapboxgl.Marker /> per walkbook anchored
  // at its centroid (or first stop). Tapping a pin (or its route line)
  // selects the walkbook: the map isolates it + the React bottom-sheet
  // below renders the summary, actions, and Open preview link.
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const attach = () => {
      for (const m of markersRef.current) m.remove();
      markersRef.current = [];

      for (const w of visibleWalkbooks) {
        if (!w.anchor) continue;
        const color = walkbookColor(w.id);
        const mine = mineSet.has(w.id);
        const label = walkbookPinLabel(w.name, w.id);
        const el = document.createElement("button");
        el.type = "button";
        el.setAttribute("aria-label", `${w.name} walkbook`);
        el.style.cssText = [
          "width:36px",
          "height:44px",
          "border:0",
          "padding:0",
          "background:transparent",
          "cursor:pointer",
          "display:block",
          "transform:translate(-50%,-100%)",
        ].join(";");
        el.innerHTML = pinSvg(color, mine, label);
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          setSelectedWalkbookId(w.id);
        });

        const marker = new mapboxgl.Marker({ element: el, anchor: "bottom" })
          .setLngLat([w.anchor.lng, w.anchor.lat])
          .addTo(map);
        markersRef.current.push(marker);
      }
    };
    if (map.isStyleLoaded()) attach();
    else map.once("load", attach);
    return () => {
      for (const m of markersRef.current) m.remove();
      markersRef.current = [];
    };
  }, [visibleWalkbooks, mineSet]);

  // Tapping a route line also selects the walkbook.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const onClick = (e: mapboxgl.MapMouseEvent & { features?: mapboxgl.MapboxGeoJSONFeature[] }) => {
      const id = (e.features?.[0]?.properties as { id?: string } | undefined)?.id;
      if (id) setSelectedWalkbookId(id);
    };
    map.on("click", "wb-lines", onClick);
    return () => {
      map.off("click", "wb-lines", onClick);
    };
  }, []);

  // Whenever a selection changes, zoom the map to its bounds so the
  // isolated walkbook fills the viewport.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedWalkbookId) return;
    const w = walkbookViz.find((v) => v.id === selectedWalkbookId);
    if (!w || w.stops.length === 0) return;
    const bounds = new mapboxgl.LngLatBounds();
    for (const s of w.stops) bounds.extend([s.lng, s.lat]);
    map.fitBounds(bounds, { padding: 64, maxZoom: 17, duration: 450 });
  }, [selectedWalkbookId, walkbookViz]);

  const selectedWalkbook = useMemo(
    () => (selectedWalkbookId ? walkbookViz.find((w) => w.id === selectedWalkbookId) ?? null : null),
    [selectedWalkbookId, walkbookViz],
  );

  function toggleStatus(s: HouseholdStatus) {
    setStatusFilter((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }

  function findNext() {
    if (!position) return;
    const candidates = visibleHouseholds.filter((h) => h.status === "not_knocked");
    if (candidates.length === 0) return;
    const nearest = candidates
      .map((h) => ({ h, d: haversineMeters(position, h) }))
      .sort((a, b) => a.d - b.d)[0];
    if (nearest) router.push(`/app/household/${nearest.h.id}`);
  }

  const mineCount = mineSet.size;

  return (
    <div className="relative h-full w-full">
      <div ref={mapContainer} className="h-full w-full" />

      {/* Filter chips — always fit on-screen (2 rows × 3 columns), no scroll. */}
      <div className="pointer-events-none absolute inset-x-0 top-2 z-10 px-2">
        <div className="pointer-events-auto grid grid-cols-3 gap-1.5">
          {STATUS_OPTIONS.map((s) => {
            const active = statusFilter.has(s);
            return (
              <button
                key={s}
                onClick={() => toggleStatus(s)}
                className={`flex items-center justify-center gap-1 rounded-full border px-2 py-1.5 text-[11px] font-medium shadow-sm backdrop-blur ${
                  active
                    ? "border-transparent bg-navy text-white"
                    : "border-navy-100 bg-white/90 text-navy"
                }`}
                title={HOUSEHOLD_STATUS_LABELS[s]}
              >
                <span
                  className="h-2 w-2 flex-none rounded-full"
                  style={{ backgroundColor: HOUSEHOLD_PIN_COLORS[s] }}
                  aria-hidden
                />
                <span className="truncate">{SHORT_LABELS[s]}</span>
              </button>
            );
          })}
        </div>
        {mineCount > 0 && !selectedWalkbookId ? (
          <div className="pointer-events-auto mt-1.5 flex justify-center">
            <button
              onClick={() => setMyWalkbookOnly((v) => !v)}
              className={`rounded-full border px-3 py-1 text-[11px] font-medium shadow-sm backdrop-blur ${
                myWalkbookOnly
                  ? "border-transparent bg-navy text-white"
                  : "border-navy-100 bg-white/90 text-navy"
              }`}
            >
              {myWalkbookOnly
                ? `Showing my ${mineCount} walkbook${mineCount === 1 ? "" : "s"} · Show all`
                : `Showing all walkbooks · Show my ${mineCount}`}
            </button>
          </div>
        ) : null}
        {selectedWalkbookId ? (
          <div className="pointer-events-auto mt-1.5 flex justify-center">
            <button
              onClick={() => setSelectedWalkbookId(null)}
              className="rounded-full border border-navy-100 bg-white/90 px-3 py-1 text-[11px] font-medium text-navy shadow-sm backdrop-blur"
            >
              ← Back to all walkbooks
            </button>
          </div>
        ) : null}
      </div>

      {!selectedWalkbook ? (
        <>
          <button
            onClick={findNext}
            className="absolute bottom-6 right-4 z-10 flex items-center gap-2 rounded-full bg-crimson px-5 py-3 text-sm font-semibold text-white shadow-lg hover:bg-crimson-700"
          >
            <Navigation className="h-4 w-4" />
            Find next
          </button>
          <div className="absolute bottom-6 left-4 z-10 rounded-md bg-white/90 px-3 py-2 text-xs text-navy-700 shadow">
            {visibleHouseholds.length} houses · {visibleWalkbooks.length}/{walkbooks.length} walkbooks
          </div>
        </>
      ) : (
        <WalkbookSheet
          walkbook={selectedWalkbook}
          mine={mineSet.has(selectedWalkbook.id)}
          selfAssigned={selfAssignedSet.has(selectedWalkbook.id)}
          onClose={() => setSelectedWalkbookId(null)}
          onOpenPreview={() => router.push(`/app/walkbooks/${selectedWalkbook.id}/preview`)}
          onAfterChange={() => router.refresh()}
        />
      )}
    </div>
  );
}

// Bottom sheet that replaces the previous tiny Mapbox popover. Roomier, has
// real tap targets, and lives above the safe-area so nothing is covered.
function WalkbookSheet({
  walkbook,
  mine,
  selfAssigned,
  onClose,
  onOpenPreview,
  onAfterChange,
}: {
  walkbook: WalkbookViz;
  mine: boolean;
  selfAssigned: boolean;
  onClose: () => void;
  onOpenPreview: () => void;
  onAfterChange: () => void;
}) {
  const [busy, setBusy] = useState<"assign" | "remove" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function assignToMe() {
    setBusy("assign");
    setError(null);
    try {
      const res = await fetch(`/api/walkbooks/${walkbook.id}/self-assign`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message ?? body.error ?? `${res.status}`);
      onAfterChange();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function removeFromMine() {
    setBusy("remove");
    setError(null);
    try {
      const res = await fetch(`/api/walkbooks/${walkbook.id}/self-assign`, { method: "DELETE" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message ?? body.error ?? `${res.status}`);
      onAfterChange();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const statusLabel =
    walkbook.status === "complete"
      ? "Complete"
      : walkbook.status === "in_progress"
        ? "In progress"
        : "Open";

  return (
    <div
      className="pointer-events-auto absolute inset-x-0 bottom-0 z-20 rounded-t-2xl border-t border-navy-100 bg-white p-4 shadow-[0_-8px_30px_-8px_rgba(0,0,0,0.25)]"
      role="dialog"
      aria-label="Walkbook summary"
    >
      <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-navy-100" aria-hidden />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-navy-500">
            {statusLabel}
            {mine ? " · Assigned to you" : ""}
          </p>
          <h2 className="truncate font-serif text-lg font-semibold text-navy-900">
            {formatWalkbookName(walkbook.name)}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex h-8 w-8 flex-none items-center justify-center rounded-full border border-navy-100 bg-white text-navy-700"
        >
          ×
        </button>
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-md border border-navy-50 bg-navy-50/40 py-2">
          <dt className="text-[10px] uppercase tracking-widest text-navy-500">Doors</dt>
          <dd className="mt-0.5 font-mono text-lg font-semibold tabular-nums text-navy-900">
            {walkbook.household_count}
          </dd>
        </div>
        <div className="rounded-md border border-navy-50 bg-navy-50/40 py-2">
          <dt className="text-[10px] uppercase tracking-widest text-navy-500">Stops</dt>
          <dd className="mt-0.5 font-mono text-lg font-semibold tabular-nums text-navy-900">
            {walkbook.stops.length}
          </dd>
        </div>
        <div className="rounded-md border border-navy-50 bg-navy-50/40 py-2">
          <dt className="text-[10px] uppercase tracking-widest text-navy-500">Estimate</dt>
          <dd className="mt-0.5 font-mono text-lg font-semibold tabular-nums text-navy-900">
            {walkbook.estimated_duration_minutes != null
              ? `~${walkbook.estimated_duration_minutes}m`
              : "—"}
          </dd>
        </div>
      </dl>

      {error ? (
        <p className="mt-3 rounded bg-crimson/10 px-3 py-2 text-xs text-crimson">{error}</p>
      ) : null}

      <div className="mt-4 flex flex-col gap-2">
        <button
          type="button"
          onClick={onOpenPreview}
          className="h-12 rounded-xl bg-navy-900 text-sm font-semibold text-white active:scale-[0.98]"
        >
          Open preview →
        </button>
        <div className="grid grid-cols-2 gap-2">
          {mine ? (
            <button
              type="button"
              onClick={removeFromMine}
              disabled={!selfAssigned || busy !== null}
              className="h-12 rounded-xl border-2 border-navy-100 bg-white text-sm font-semibold text-navy-700 disabled:opacity-50 active:scale-[0.98]"
              title={
                selfAssigned
                  ? "Remove from my walkbooks"
                  : "Your admin assigned this — ask them to remove it"
              }
            >
              {busy === "remove" ? "Removing…" : selfAssigned ? "Remove from mine" : "Admin-assigned"}
            </button>
          ) : (
            <button
              type="button"
              onClick={assignToMe}
              disabled={busy !== null}
              className="h-12 rounded-xl border-2 border-navy-900 bg-white text-sm font-semibold text-navy-900 active:scale-[0.98]"
            >
              {busy === "assign" ? "Assigning…" : "Assign to me"}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="h-12 rounded-xl border-2 border-navy-100 bg-white text-sm font-semibold text-navy-700 active:scale-[0.98]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// Teardrop pin with a white center disc carrying the walkbook's number so
// the pin is self-identifying when a cluster of walkbooks is visible.
// `mine` thickens the stroke so this knocker's own walkbooks stand out.
// The inner disc auto-sizes so 1–3 digit labels all fit without clipping.
function pinSvg(color: string, mine: boolean, label: string): string {
  const stroke = mine ? "#0B1F3A" : "#ffffff";
  const strokeW = mine ? 2 : 1.5;
  const discR = label.length >= 3 ? 9 : 8;
  const fontSize = label.length >= 3 ? 9 : label.length === 2 ? 10 : 12;
  const safe = label.replace(/[<>&"']/g, "");
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 44" width="36" height="44" aria-hidden="true">
      <path
        d="M18 1 C8.7 1 1 8.4 1 17.2 c0 12.2 17 25.8 17 25.8 s17-13.6 17-25.8 C35 8.4 27.3 1 18 1 z"
        fill="${color}" stroke="${stroke}" stroke-width="${strokeW}" />
      <circle cx="18" cy="17" r="${discR}" fill="#ffffff" />
      <text x="18" y="17" text-anchor="middle" dominant-baseline="central"
        font-family="'JetBrains Mono','SF Mono',ui-monospace,monospace"
        font-size="${fontSize}" font-weight="700" fill="${color}">${safe}</text>
    </svg>`;
}
