"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl, { type GeoJSONSource } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useRouter } from "next/navigation";
import { useFieldStore } from "@/lib/offline/store";
import { publicEnv } from "@/lib/env";
import { HOUSEHOLD_PIN_COLORS, HOUSEHOLD_STATUS_LABELS, type Household, type HouseholdStatus, type Walkbook } from "@/lib/types";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { computeBoundingBox, haversineMeters } from "@/lib/geo/distance";
import { Navigation } from "lucide-react";

mapboxgl.accessToken = publicEnv.mapboxToken;

interface MapViewProps {
  userId: string;
  districtId: string;
  households: Household[];
  walkbooks: Walkbook[];
}

const STATUS_OPTIONS: HouseholdStatus[] = [
  "not_knocked",
  "no_answer",
  "come_back_later",
  "contacted",
  "refused",
  "mixed",
];

export function MapView({ userId, districtId, households: initialHouseholds, walkbooks }: MapViewProps) {
  const router = useRouter();
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [statusFilter, setStatusFilter] = useState<Set<HouseholdStatus>>(new Set(STATUS_OPTIONS));
  const [myWalkbookOnly, setMyWalkbookOnly] = useState(false);
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
        (payload) => {
          const row = payload.new as Household | undefined;
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

  // GPS
  useEffect(() => {
    if (!navigator.geolocation) return;
    const watcher = navigator.geolocation.watchPosition(
      (pos) => setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => void 0,
      { enableHighAccuracy: true, maximumAge: 10_000 },
    );
    return () => navigator.geolocation.clearWatch(watcher);
  }, []);

  const visibleHouseholds = useMemo(() => {
    return Array.from(households.values()).filter((h) => statusFilter.has(h.status));
  }, [households, statusFilter]);

  const featureCollection = useMemo(
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
        geometry: { type: "Point" as const, coordinates: [h.lng, h.lat] },
      })),
    }),
    [visibleHouseholds],
  );

  // Init map
  useEffect(() => {
    if (mapRef.current || !mapContainer.current) return;
    const bbox = computeBoundingBox(initialHouseholds.map((h) => ({ lat: h.lat, lng: h.lng })));
    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: bbox ? [(bbox.east + bbox.west) / 2, (bbox.north + bbox.south) / 2] : [-80.85, 33.93],
      zoom: 13,
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    map.on("load", () => {
      map.addSource("households", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        cluster: true,
        clusterRadius: 40,
        clusterMaxZoom: 15,
      });
      map.addLayer({
        id: "household-clusters",
        type: "circle",
        source: "households",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "#0B1F3A",
          "circle-radius": ["step", ["get", "point_count"], 18, 10, 22, 30, 28],
          "circle-opacity": 0.85,
        },
      });
      map.addLayer({
        id: "household-cluster-count",
        type: "symbol",
        source: "households",
        filter: ["has", "point_count"],
        layout: {
          "text-field": "{point_count_abbreviated}",
          "text-size": 13,
        },
        paint: { "text-color": "#ffffff" },
      });
      map.addLayer({
        id: "household-points",
        type: "circle",
        source: "households",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": ["get", "color"],
          "circle-radius": 10,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
        },
      });

      map.on("click", "household-points", (e) => {
        const id = (e.features?.[0]?.properties as { id?: string } | undefined)?.id;
        if (id) router.push(`/app/household/${id}`);
      });
      map.on("click", "household-clusters", (e) => {
        const cluster = e.features?.[0];
        const source = map.getSource("households") as GeoJSONSource;
        if (!cluster) return;
        source.getClusterExpansionZoom((cluster.properties as { cluster_id: number }).cluster_id, (err, zoom) => {
          if (err) return;
          const geom = cluster.geometry as unknown as { coordinates: [number, number] };
          map.easeTo({ center: geom.coordinates, zoom });
        });
      });
      map.on("mouseenter", "household-points", () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", "household-points", () => (map.getCanvas().style.cursor = ""));
    });
    mapRef.current = map;
    return () => map.remove();
  }, [initialHouseholds, router]);

  // Feed the source
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      const src = map.getSource("households") as GeoJSONSource | undefined;
      if (src) src.setData(featureCollection);
    };
    if (map.isStyleLoaded()) apply();
    else map.once("load", apply);
  }, [featureCollection]);

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

  return (
    <div className="relative h-full w-full">
      <div ref={mapContainer} className="h-full w-full" />
      <div className="absolute left-0 right-0 top-3 z-10 flex snap-x gap-2 overflow-x-auto px-3">
        {STATUS_OPTIONS.map((s) => {
          const active = statusFilter.has(s);
          return (
            <button
              key={s}
              onClick={() => toggleStatus(s)}
              className={`flex shrink-0 snap-start items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium shadow-sm backdrop-blur ${
                active ? "border-transparent bg-navy text-white" : "border-navy-100 bg-white/90 text-navy"
              }`}
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: HOUSEHOLD_PIN_COLORS[s] }}
              />
              {HOUSEHOLD_STATUS_LABELS[s]}
            </button>
          );
        })}
      </div>
      <button
        onClick={findNext}
        className="absolute bottom-6 right-4 z-10 flex items-center gap-2 rounded-full bg-crimson px-5 py-3 text-sm font-semibold text-white shadow-lg hover:bg-crimson-700"
      >
        <Navigation className="h-4 w-4" />
        Find next
      </button>
      <div className="absolute bottom-6 left-4 z-10 rounded-md bg-white/90 px-3 py-2 text-xs text-navy-700 shadow">
        {visibleHouseholds.length} houses · {walkbooks.length} walkbooks
      </div>
    </div>
  );
}
