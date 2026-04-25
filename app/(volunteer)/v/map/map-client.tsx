"use client";

// Screen 6 — Active map (Variant A, "Stacked sheet")
// Real Mapbox GL JS. Real GPS. Real households.

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Menu, BookOpen, Clock, MapPin as MapPinIcon, MessageSquare, CheckCircle, X } from "lucide-react";
import { T, fontInter } from "@/lib/volunteer/tokens";
import type { MapBundle, MapHousehold } from "@/lib/volunteer/load-map";

interface Props {
  mapboxToken: string;
  bundle: MapBundle;
}

// Status colours from DESIGN_SYSTEM.md § 5.7. Names use sentence case.
const STATUS_COLOR: Record<MapHousehold["status"], string> = {
  not_knocked: "#2563EB",
  come_back_later: "#F59E0B",
  no_answer: "#F97316",
  contacted: "#6B7280",
  refused: "#DC2626",
  mixed: "#7C3AED",
};

function metresBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const toRad = (n: number) => (n * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function MapClient({ mapboxToken, bundle }: Props) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const pinMarkersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const gpsMarkerRef = useRef<mapboxgl.Marker | null>(null);

  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const knockedSet = useMemo(() => new Set(bundle.knockedHouseholdIds), [bundle.knockedHouseholdIds]);
  const next = useMemo(
    () => bundle.households.find((h) => !knockedSet.has(h.id) && h.status === "not_knocked") ??
      bundle.households.find((h) => !knockedSet.has(h.id)) ??
      null,
    [bundle.households, knockedSet],
  );
  const completed = bundle.households.length > 0 && !next;
  const total = bundle.households.length;
  const knocked = knockedSet.size;

  // Auto-route to wrap-up when all households are done.
  useEffect(() => {
    if (completed) router.push("/v/complete");
  }, [completed, router]);

  // Subscribe to GPS once.
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (pos) => setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => undefined,
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  // Initialise Mapbox once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    if (!mapboxToken) return;
    mapboxgl.accessToken = mapboxToken;

    const center =
      next != null
        ? { lat: next.lat, lng: next.lng }
        : bundle.households[0]
        ? { lat: bundle.households[0].lat, lng: bundle.households[0].lng }
        : { lat: 32.7765, lng: -79.9311 }; // Charleston as a sensible fallback.

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [center.lng, center.lat],
      zoom: 16,
      attributionControl: false,
    });
    mapRef.current = map;

    map.on("load", () => {
      // Render every household pin.
      for (const hh of bundle.households) {
        const isKnocked = knockedSet.has(hh.id);
        const isNext = next?.id === hh.id;
        const color = isKnocked ? "#6B7280" : STATUS_COLOR[hh.status] ?? "#2563EB";
        const el = buildPinElement({ color, isNext, label: String(hh.orderIndex + 1) });
        el.addEventListener("click", () => router.push(`/v/household/${hh.id}`));
        const m = new mapboxgl.Marker({ element: el, anchor: "center" })
          .setLngLat([hh.lng, hh.lat])
          .addTo(map);
        pinMarkersRef.current.set(hh.id, m);
      }

      // Fit bounds to the walkbook on first paint.
      if (bundle.households.length > 0) {
        const bounds = new mapboxgl.LngLatBounds();
        for (const hh of bundle.households) bounds.extend([hh.lng, hh.lat]);
        map.fitBounds(bounds, { padding: 80, maxZoom: 17, duration: 0 });
      }
    });

    return () => {
      pinMarkersRef.current.forEach((m) => m.remove());
      pinMarkersRef.current.clear();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapboxToken]);

  // Update / add the GPS marker when the position changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !gps) return;
    if (!gpsMarkerRef.current) {
      const el = document.createElement("div");
      el.style.width = "16px";
      el.style.height = "16px";
      el.style.borderRadius = "50%";
      el.style.background = "#2563EB";
      el.style.border = "2px solid white";
      el.style.boxShadow = "0 0 0 4px rgba(37,99,235,0.18)";
      gpsMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: "center" })
        .setLngLat([gps.lng, gps.lat])
        .addTo(map);
    } else {
      gpsMarkerRef.current.setLngLat([gps.lng, gps.lat]);
    }
  }, [gps]);

  // Pulse only the next pin. Iterates each render so the animation always
  // points at the current "next".
  useEffect(() => {
    pinMarkersRef.current.forEach((marker, hhId) => {
      const el = marker.getElement();
      const dot = el.querySelector<HTMLElement>("[data-role=pin-dot]");
      const ring = el.querySelector<HTMLElement>("[data-role=pin-ring]");
      if (!dot || !ring) return;
      const isNext = hhId === next?.id;
      ring.style.opacity = isNext ? "1" : "0";
      ring.style.animation = isNext ? "vol-pulse 1.5s ease-in-out infinite" : "none";
      dot.style.transform = isNext ? "scale(1.15)" : "scale(1)";
    });
  }, [next?.id]);

  const distanceToNext =
    gps && next ? Math.round(metresBetween(gps, { lat: next.lat, lng: next.lng })) : null;

  const elapsedMs = bundle.knockSession
    ? Date.now() - new Date(bundle.knockSession.startedAt).getTime()
    : 0;
  const plannedMs =
    bundle.knockSession?.plannedMinutes != null ? bundle.knockSession.plannedMinutes * 60_000 : null;
  const runningLow =
    !bannerDismissed &&
    plannedMs != null &&
    elapsedMs / plannedMs >= 0.8 &&
    elapsedMs / plannedMs < 1.5; // hide if they're way over.

  const onWrap = () => {
    setMenuOpen(false);
    router.push("/v/complete");
  };

  return (
    <div
      style={{
        flex: 1,
        boxSizing: "border-box",
        position: "relative",
        background: T.white,
        fontFamily: fontInter,
        overflow: "hidden",
      }}
    >
      {/* Mapbox container fills the screen */}
      <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />

      {/* Top bar */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 48,
          padding: "12px 16px",
          background: T.slate50,
          borderBottom: `1px solid ${T.slate200}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 14,
          color: T.navy900,
        }}
      >
        <div style={{ fontWeight: 500 }}>
          {knocked} of {total} &middot; {bundle.contactCount} contacts
        </div>
        <button
          onClick={() => setMenuOpen(true)}
          aria-label="Open menu"
          style={{
            width: 32,
            height: 32,
            border: "none",
            background: "transparent",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: T.navy700,
            cursor: "pointer",
          }}
        >
          <Menu size={20} />
        </button>
      </div>

      {/* Running-low banner */}
      {runningLow ? (
        <div
          style={{
            position: "absolute",
            left: 16,
            right: 16,
            bottom: 72,
            padding: "12px 16px",
            background: T.amber100,
            border: "1px solid #FCD34D",
            borderRadius: 12,
            display: "flex",
            alignItems: "center",
            gap: 12,
            fontSize: 13,
            color: "#78350F",
          }}
        >
          <div style={{ flex: 1 }}>
            You&rsquo;re at {Math.round(elapsedMs / 60_000)} of{" "}
            {bundle.knockSession?.plannedMinutes ?? "?"} min &middot;{" "}
            {Math.max(0, total - knocked)} houses left
          </div>
          <button
            onClick={onWrap}
            style={{
              padding: "6px 12px",
              border: "1px solid #FCD34D",
              background: "white",
              borderRadius: 8,
              color: "#78350F",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Wrap up
          </button>
          <button
            onClick={() => setBannerDismissed(true)}
            aria-label="Dismiss"
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              color: "#78350F",
            }}
          >
            <X size={18} />
          </button>
        </div>
      ) : null}

      {/* Bottom bar — entire bar tappable goes to next pin's household */}
      {next ? (
        <button
          onClick={() => router.push(`/v/household/${next.id}`)}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: 56,
            padding: "0 16px",
            background: T.white,
            borderTop: `1px solid ${T.slate200}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            cursor: "pointer",
            fontFamily: fontInter,
            color: T.navy900,
          }}
        >
          <span style={{ fontWeight: 500, fontSize: 14, textAlign: "left" }}>
            Next: {next.addressLine1}
            {distanceToNext != null ? ` · ${formatDistance(distanceToNext)}` : ""}
          </span>
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke={T.navy700}
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12h14M13 5l7 7-7 7" />
          </svg>
        </button>
      ) : null}

      {/* Menu sheet */}
      {menuOpen ? (
        <div
          role="dialog"
          aria-label="Menu"
          onClick={() => setMenuOpen(false)}
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(10,22,40,0.42)",
            display: "flex",
            alignItems: "flex-end",
            zIndex: 10,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxHeight: "60%",
              background: T.white,
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              padding: "16px 8px 24px",
              boxShadow: "0 -8px 24px rgba(10,22,40,0.16)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0 12px 8px",
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 18, color: T.navy900 }}>Menu</div>
              <button
                onClick={() => setMenuOpen(false)}
                aria-label="Close menu"
                style={{ background: "transparent", border: "none", cursor: "pointer", color: T.navy700 }}
              >
                <X size={20} />
              </button>
            </div>
            <MenuItem
              icon={<BookOpen size={20} />}
              label="Refresh me on the script"
              onClick={() => router.push(`/v/walkbook/${bundle.walkbookId}/briefing`)}
            />
            <MenuItem
              icon={<Clock size={20} />}
              label="I’m running low on time"
              onClick={onWrap}
            />
            <MenuItem
              icon={<MapPinIcon size={20} />}
              label="Pick a different walkbook"
              onClick={() => router.push("/v/walkbook")}
            />
            <MenuItem
              icon={<MessageSquare size={20} />}
              label="Message admin"
              onClick={() => router.push("/v/walkbook")}
            />
            <div style={{ borderTop: `1px solid ${T.slate100}`, margin: "8px 0" }} />
            <MenuItem
              icon={<CheckCircle size={20} />}
              label="Wrap up this session"
              onClick={onWrap}
              emphasis
            />
          </div>
        </div>
      ) : null}

      <style jsx global>{`
        @keyframes vol-pulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.5); opacity: 0.5; }
          100% { transform: scale(1); opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-role="pin-ring"] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  emphasis,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  emphasis?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        height: 56,
        padding: "0 16px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        background: "transparent",
        border: "none",
        cursor: "pointer",
        color: T.navy900,
        fontFamily: fontInter,
        fontWeight: emphasis ? 600 : 500,
        fontSize: 16,
        textAlign: "left",
      }}
    >
      <span style={{ color: T.navy700, display: "inline-flex" }}>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function buildPinElement({
  color,
  isNext,
  label,
}: {
  color: string;
  isNext: boolean;
  label: string;
}) {
  const wrap = document.createElement("div");
  wrap.style.position = "relative";
  wrap.style.width = "40px";
  wrap.style.height = "40px";
  wrap.style.cursor = "pointer";

  const ring = document.createElement("div");
  ring.dataset.role = "pin-ring";
  ring.style.position = "absolute";
  ring.style.inset = "0";
  ring.style.borderRadius = "50%";
  ring.style.border = `2px solid ${color}`;
  ring.style.opacity = isNext ? "1" : "0";
  if (isNext) ring.style.animation = "vol-pulse 1.5s ease-in-out infinite";
  wrap.appendChild(ring);

  const dot = document.createElement("div");
  dot.dataset.role = "pin-dot";
  dot.style.position = "absolute";
  dot.style.left = "4px";
  dot.style.top = "4px";
  dot.style.width = "32px";
  dot.style.height = "32px";
  dot.style.borderRadius = "50%";
  dot.style.background = color;
  dot.style.border = "2px solid white";
  dot.style.color = "white";
  dot.style.fontFamily = "Inter, sans-serif";
  dot.style.fontWeight = "600";
  dot.style.fontSize = "12px";
  dot.style.display = "flex";
  dot.style.alignItems = "center";
  dot.style.justifyContent = "center";
  dot.style.transition = "transform 200ms ease-out";
  if (isNext) dot.style.transform = "scale(1.15)";
  dot.textContent = label;
  wrap.appendChild(dot);

  return wrap;
}

function formatDistance(metres: number): string {
  if (metres < 1000) return `${metres} m`;
  return `${(metres / 1000).toFixed(1)} km`;
}
