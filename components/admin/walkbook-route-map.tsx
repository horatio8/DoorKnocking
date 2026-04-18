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
    const bounds = new mapboxgl.LngLatBounds();
    for (const s of stops) bounds.extend([s.lng, s.lat]);

    const map = new mapboxgl.Map({
      container: ref.current,
      style: "mapbox://styles/mapbox/streets-v12",
      bounds,
      fitBoundsOptions: { padding: 60, maxZoom: 17 },
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    mapRef.current = map;

    map.on("load", () => {
      // Straight-line connector — replaced by real polyline below if we get
      // one from the API.
      const straight: Array<[number, number]> = stops.map((s) => [s.lng, s.lat]);
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

      // Numbered markers.
      stops.forEach((s, i) => {
        const el = document.createElement("div");
        el.style.cssText =
          "display:flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:9999px;background:#0B1F3A;color:#fff;font:600 11px system-ui;border:2px solid #fff;box-shadow:0 1px 2px rgba(0,0,0,.25)";
        el.textContent = String(i + 1);
        new mapboxgl.Marker({ element: el, anchor: "center" })
          .setLngLat([s.lng, s.lat])
          .setPopup(
            new mapboxgl.Popup({ offset: 16 }).setHTML(
              `<div style="font:12px system-ui;color:#0B1F3A;padding:2px 4px"><strong>#${i + 1}</strong> ${escapeHtml(s.address || "")}</div>`,
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
