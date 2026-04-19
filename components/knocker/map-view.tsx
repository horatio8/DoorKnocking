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
}: MapViewProps) {
  const router = useRouter();
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [statusFilter, setStatusFilter] = useState<Set<HouseholdStatus>>(new Set(STATUS_OPTIONS));
  const [myWalkbookOnly, setMyWalkbookOnly] = useState(myWalkbookIds.length > 0);
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

  // Which walkbooks to show on the map (respects "mine only" toggle).
  const mineSet = useMemo(() => new Set(myWalkbookIds), [myWalkbookIds]);
  const visibleWalkbooks = useMemo(() => {
    if (!myWalkbookOnly || mineSet.size === 0) return walkbookViz;
    return walkbookViz.filter((w) => mineSet.has(w.id));
  }, [walkbookViz, myWalkbookOnly, mineSet]);

  // Households to plot — filtered by status, optionally narrowed to this
  // knocker's walkbooks.
  const visibleHouseholds = useMemo(() => {
    const inMyWB = new Set<string>();
    if (myWalkbookOnly && mineSet.size > 0) {
      // Approximate: include any household whose coord matches a stop in my
      // walkbooks. This avoids a separate prop for ids while keeping the
      // filter precise enough for field use.
      const stopKeys = new Set<string>();
      for (const w of walkbookViz) {
        if (!mineSet.has(w.id)) continue;
        for (const s of w.stops) stopKeys.add(`${s.lat.toFixed(5)}|${s.lng.toFixed(5)}`);
      }
      for (const h of Array.from(households.values())) {
        const key = `${Number(h.lat).toFixed(5)}|${Number(h.lng).toFixed(5)}`;
        if (stopKeys.has(key)) inMyWB.add(h.id);
      }
    }
    return Array.from(households.values()).filter((h) => {
      if (!statusFilter.has(h.status)) return false;
      if (myWalkbookOnly && mineSet.size > 0 && !inMyWB.has(h.id)) return false;
      return true;
    });
  }, [households, statusFilter, myWalkbookOnly, mineSet, walkbookViz]);

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

      // Hover label on walkbook lines so knockers can see which walkbook
      // they're looking at at a glance.
      let linePopup: mapboxgl.Popup | null = null;
      map.on("mousemove", "wb-lines", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const name = (f.properties as { name?: string })?.name ?? "";
        if (linePopup) linePopup.remove();
        linePopup = new mapboxgl.Popup({ closeButton: false, closeOnClick: false })
          .setLngLat(e.lngLat)
          .setHTML(`<div style="font:12px system-ui;color:#0B1F3A;padding:2px 4px">${escapeHtml(name)}</div>`)
          .addTo(map);
      });
      map.on("mouseleave", "wb-lines", () => {
        if (linePopup) {
          linePopup.remove();
          linePopup = null;
        }
      });
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
  // at its centroid (or first stop). Each pin opens a summary popup with an
  // "Open preview" link.
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const attach = () => {
      // Tear down previous markers before re-creating.
      for (const m of markersRef.current) m.remove();
      markersRef.current = [];

      for (const w of visibleWalkbooks) {
        if (!w.anchor) continue;
        const color = walkbookColor(w.id);
        const mine = mineSet.has(w.id);
        const el = document.createElement("button");
        el.type = "button";
        el.setAttribute("aria-label", `${w.name} walkbook`);
        el.style.cssText = [
          "width:32px",
          "height:40px",
          "border:0",
          "padding:0",
          "background:transparent",
          "cursor:pointer",
          "display:block",
          "transform:translate(-50%,-100%)",
        ].join(";");
        el.innerHTML = pinSvg(color, mine);

        const popup = new mapboxgl.Popup({
          offset: 32,
          closeButton: true,
          maxWidth: "260px",
        }).setHTML(walkbookSummaryHTML(w, mine));

        const marker = new mapboxgl.Marker({ element: el, anchor: "bottom" })
          .setLngLat([w.anchor.lng, w.anchor.lat])
          .setPopup(popup)
          .addTo(map);

        // Delegate clicks on the "Open preview" link inside the popup.
        popup.on("open", () => {
          const node = popup.getElement();
          if (!node) return;
          const link = node.querySelector<HTMLAnchorElement>("[data-wb-open]");
          if (link) {
            link.addEventListener(
              "click",
              (e) => {
                e.preventDefault();
                router.push(`/app/walkbooks/${w.id}/preview`);
              },
              { once: true },
            );
          }
        });

        markersRef.current.push(marker);
      }
    };
    if (map.isStyleLoaded()) attach();
    else map.once("load", attach);
    return () => {
      for (const m of markersRef.current) m.remove();
      markersRef.current = [];
    };
  }, [visibleWalkbooks, mineSet, router]);

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
        {mineCount > 0 ? (
          <div className="pointer-events-auto mt-1.5 flex justify-center">
            <button
              onClick={() => setMyWalkbookOnly((v) => !v)}
              className={`rounded-full border px-3 py-1 text-[11px] font-medium shadow-sm backdrop-blur ${
                myWalkbookOnly
                  ? "border-transparent bg-navy text-white"
                  : "border-navy-100 bg-white/90 text-navy"
              }`}
            >
              {myWalkbookOnly ? `Showing my ${mineCount} walkbook${mineCount === 1 ? "" : "s"}` : "Show all walkbooks"}
            </button>
          </div>
        ) : null}
      </div>

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
    </div>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;",
  );
}

// Teardrop pin with a white center disc. `mine` thickens the stroke so this
// knocker's own walkbooks stand out even at low zoom.
function pinSvg(color: string, mine: boolean): string {
  const stroke = mine ? "#0B1F3A" : "#ffffff";
  const strokeW = mine ? 2 : 1.5;
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 40" width="32" height="40" aria-hidden="true">
      <path
        d="M16 1 C7.7 1 1 7.6 1 15.6 c0 11 15 23 15 23 s15-12 15-23 C31 7.6 24.3 1 16 1 z"
        fill="${color}" stroke="${stroke}" stroke-width="${strokeW}" />
      <circle cx="16" cy="15.5" r="5.5" fill="#ffffff" />
    </svg>`;
}

function walkbookSummaryHTML(
  w: {
    id: string;
    name: string;
    household_count: number;
    estimated_duration_minutes: number | null;
    stops: Array<unknown>;
    status: string;
  },
  mine: boolean,
): string {
  const mins = w.estimated_duration_minutes;
  const statusLabel =
    w.status === "complete"
      ? "Complete"
      : w.status === "in_progress"
        ? "In progress"
        : "Open";
  const statusColor =
    w.status === "complete" ? "#059669" : w.status === "in_progress" ? "#d97706" : "#0B1F3A";
  return `
    <div style="font:13px system-ui;color:#0B1F3A;min-width:200px;padding:2px 2px 0">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">
        <strong style="font-size:14px;line-height:1.2;">${escapeHtml(w.name)}</strong>
        <span style="font-size:10px;padding:1px 6px;border-radius:9999px;background:${statusColor}20;color:${statusColor};white-space:nowrap;text-transform:uppercase;letter-spacing:0.04em;">
          ${statusLabel}
        </span>
      </div>
      ${mine ? `<div style="margin-top:4px;font-size:11px;color:#059669;">Assigned to you</div>` : ""}
      <dl style="margin:8px 0 10px;display:grid;grid-template-columns:auto 1fr;gap:2px 8px;font-size:12px;">
        <dt style="color:#6b7280;">Doors</dt><dd style="margin:0;">${w.household_count}</dd>
        <dt style="color:#6b7280;">Stops</dt><dd style="margin:0;">${w.stops.length}</dd>
        ${mins != null ? `<dt style="color:#6b7280;">Estimate</dt><dd style="margin:0;">~${mins} min</dd>` : ""}
      </dl>
      <a data-wb-open href="/app/walkbooks/${w.id}/preview"
         style="display:inline-flex;align-items:center;gap:4px;padding:6px 10px;border-radius:6px;background:#0B1F3A;color:#fff;text-decoration:none;font-size:12px;font-weight:600;">
        Open preview →
      </a>
    </div>`;
}
