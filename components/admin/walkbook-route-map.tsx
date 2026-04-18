"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { publicEnv } from "@/lib/env";

mapboxgl.accessToken = publicEnv.mapboxToken;

export interface RouteStop {
  id: string;
  lat: number;
  lng: number;
  address: string;
  status?: string;
}

// Renders one walkbook: numbered stops + connecting polyline. Tries to
// upgrade the polyline to real Mapbox walking-route geometry by hitting
// /api/walkbooks/[id]/route-polyline; falls back to straight-line if
// MAPBOX_SECRET_TOKEN isn't set on the deployment.
export function WalkbookRouteMap({
  walkbookId,
  stops,
}: {
  walkbookId: string;
  stops: RouteStop[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [polyline, setPolyline] = useState<Array<[number, number]> | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/walkbooks/${walkbookId}/route-polyline`)
      .then((r) => r.json())
      .then((b) => {
        if (cancelled) return;
        if (Array.isArray(b.polyline)) setPolyline(b.polyline as Array<[number, number]>);
      })
      .catch(() => {
        /* fallback handled below */
      });
    return () => {
      cancelled = true;
    };
  }, [walkbookId]);

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    if (stops.length === 0) return;

    // Group stops by identical (lat,lng) — apartment buildings show up as
    // 20+ rows at the exact same coordinates, which otherwise pile markers
    // on the same pixel and look like a single cluster count.
    interface StopGroup {
      lat: number;
      lng: number;
      members: Array<{ num: number; stop: RouteStop }>;
    }
    const groups: StopGroup[] = [];
    stops.forEach((s, i) => {
      const last = groups[groups.length - 1];
      const key = `${s.lat.toFixed(6)},${s.lng.toFixed(6)}`;
      const existing = groups.find(
        (g) => `${g.lat.toFixed(6)},${g.lng.toFixed(6)}` === key,
      );
      if (existing) {
        existing.members.push({ num: i + 1, stop: s });
      } else {
        groups.push({ lat: s.lat, lng: s.lng, members: [{ num: i + 1, stop: s }] });
      }
      void last;
    });

    const bounds = new mapboxgl.LngLatBounds();
    for (const g of groups) bounds.extend([g.lng, g.lat]);

    const map = new mapboxgl.Map({
      container: ref.current,
      style: "mapbox://styles/mapbox/streets-v12",
      bounds,
      fitBoundsOptions: { padding: 60, maxZoom: 17 },
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    mapRef.current = map;

    map.on("load", () => {
      // Straight-line connector between grouped stops — deduped coordinates so
      // we don't render zero-length segments inside an apartment building.
      const straight: Array<[number, number]> = groups.map((g) => [g.lng, g.lat]);
      map.addSource("route", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: straight },
        },
      });
      map.addLayer({
        id: "route",
        type: "line",
        source: "route",
        paint: { "line-color": "#0B1F3A", "line-width": 3, "line-opacity": 0.85 },
      });

      // One marker per unique coordinate. Label is the stop-range inside that
      // building (e.g., "1-5" if stops 1 through 5 are all the same
      // address). Popup lists every apartment at that point.
      groups.forEach((g) => {
        const label =
          g.members.length === 1
            ? String(g.members[0].num)
            : `${g.members[0].num}–${g.members[g.members.length - 1].num}`;
        const width = label.length > 3 ? 36 : 28;
        const el = document.createElement("div");
        el.style.cssText = `display:flex;align-items:center;justify-content:center;min-width:${width}px;height:${width}px;padding:0 6px;border-radius:9999px;background:#0B1F3A;color:#fff;font:600 11px system-ui;border:2px solid #fff;box-shadow:0 1px 2px rgba(0,0,0,.25);white-space:nowrap`;
        el.textContent = label;

        const popupHtml = g.members
          .map(
            (m) =>
              `<div style="padding:2px 0"><strong>#${m.num}</strong> ${escapeHtml(m.stop.address || "")}</div>`,
          )
          .join("");

        new mapboxgl.Marker({ element: el, anchor: "center" })
          .setLngLat([g.lng, g.lat])
          .setPopup(
            new mapboxgl.Popup({ offset: 16, maxWidth: "300px" }).setHTML(
              `<div style="font:12px system-ui;color:#0B1F3A;padding:4px 6px">${popupHtml}</div>`,
            ),
          )
          .addTo(map);
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [stops]);

  // Once the real polyline arrives, swap the line geometry.
  useEffect(() => {
    if (!polyline || !mapRef.current) return;
    const map = mapRef.current;
    const apply = () => {
      const src = map.getSource("route") as mapboxgl.GeoJSONSource | undefined;
      if (!src) return;
      src.setData({
        type: "Feature",
        properties: {},
        geometry: { type: "LineString", coordinates: polyline },
      });
    };
    if (map.isStyleLoaded()) apply();
    else map.once("load", apply);
  }, [polyline]);

  if (stops.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-white p-6 text-center text-sm text-muted-foreground">
        No stops with coordinates on this walkbook.
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className="h-[480px] w-full overflow-hidden rounded-lg border border-border bg-navy-50"
    />
  );
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;",
  );
}
