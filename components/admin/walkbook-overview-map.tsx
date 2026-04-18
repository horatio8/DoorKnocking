"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { publicEnv } from "@/lib/env";

mapboxgl.accessToken = publicEnv.mapboxToken;

interface Stop {
  lat: number;
  lng: number;
}

export interface WalkbookViz {
  id: string;
  name: string;
  stops: Stop[];
}

// Renders every walkbook's ordered stops + connecting line on one map.
// Each walkbook gets a distinct hue from a hash of its id so they're
// visually distinguishable. Auto-fits bounds to all stops.
export function WalkbookOverviewMap({ walkbooks }: { walkbooks: WalkbookViz[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (!ref.current || mapRef.current) return;

    const all: [number, number][] = [];
    for (const w of walkbooks) {
      for (const s of w.stops) all.push([s.lng, s.lat]);
    }
    if (all.length === 0) return;

    const bounds = new mapboxgl.LngLatBounds();
    for (const c of all) bounds.extend(c as [number, number]);

    const map = new mapboxgl.Map({
      container: ref.current,
      style: "mapbox://styles/mapbox/light-v11",
      bounds,
      fitBoundsOptions: { padding: 50, maxZoom: 15 },
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    mapRef.current = map;

    map.on("load", () => {
      // One combined source for all lines (paint by feature property `color`).
      const lineFeatures = walkbooks
        .filter((w) => w.stops.length >= 2)
        .map((w, i) => ({
          type: "Feature" as const,
          properties: { color: colorFor(i, walkbooks.length), name: w.name },
          geometry: {
            type: "LineString" as const,
            coordinates: w.stops.map((s) => [s.lng, s.lat] as [number, number]),
          },
        }));
      const dotFeatures = walkbooks.flatMap((w, i) =>
        w.stops.map((s) => ({
          type: "Feature" as const,
          properties: { color: colorFor(i, walkbooks.length), name: w.name },
          geometry: { type: "Point" as const, coordinates: [s.lng, s.lat] as [number, number] },
        })),
      );

      map.addSource("wb-lines", {
        type: "geojson",
        data: { type: "FeatureCollection", features: lineFeatures },
      });
      map.addLayer({
        id: "wb-lines",
        type: "line",
        source: "wb-lines",
        paint: {
          "line-color": ["get", "color"],
          "line-width": 2,
          "line-opacity": 0.75,
        },
      });

      map.addSource("wb-dots", {
        type: "geojson",
        data: { type: "FeatureCollection", features: dotFeatures },
      });
      map.addLayer({
        id: "wb-dots",
        type: "circle",
        source: "wb-dots",
        paint: {
          "circle-color": ["get", "color"],
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 2, 14, 4, 17, 6],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1,
        },
      });

      // Hover popup with walkbook name.
      let popup: mapboxgl.Popup | null = null;
      map.on("mousemove", "wb-dots", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        map.getCanvas().style.cursor = "pointer";
        const name = (f.properties as { name?: string })?.name ?? "";
        const coords = (f.geometry as { coordinates: [number, number] }).coordinates;
        if (popup) popup.remove();
        popup = new mapboxgl.Popup({ closeButton: false, closeOnClick: false })
          .setLngLat(coords)
          .setHTML(`<div style="font:12px system-ui;color:#0B1F3A;padding:2px 4px">${escapeHtml(name)}</div>`)
          .addTo(map);
      });
      map.on("mouseleave", "wb-dots", () => {
        map.getCanvas().style.cursor = "";
        if (popup) {
          popup.remove();
          popup = null;
        }
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [walkbooks]);

  if (walkbooks.length === 0) return null;
  return (
    <div
      ref={ref}
      className="h-[500px] w-full overflow-hidden rounded-lg border border-border bg-navy-50"
    />
  );
}

function colorFor(i: number, total: number): string {
  // Spread hues evenly; saturation/lightness fixed for visual cohesion.
  const hue = Math.floor((i * 360) / Math.max(1, total));
  return `hsl(${hue}, 65%, 45%)`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;",
  );
}
