"use client";

import { useEffect, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";

// Tiny header button that toggles the browser into / out of fullscreen.
// Uses the standard Fullscreen API; on iOS Safari the user has to be in a
// PWA install or the API silently no-ops, so we hide ourselves if the API
// isn't available.
export function FullscreenToggle() {
  const [supported, setSupported] = useState(false);
  const [isFs, setIsFs] = useState(false);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const ok = Boolean(
      document.documentElement.requestFullscreen ||
        // Safari prefix
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (document.documentElement as any).webkitRequestFullscreen,
    );
    setSupported(ok);
    if (!ok) return;
    const onChange = () => setIsFs(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  if (!supported) return null;

  async function toggle() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // Some browsers refuse silently — nothing useful to surface.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isFs ? "Exit full screen" : "Enter full screen"}
      className="ml-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
    >
      {isFs ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
    </button>
  );
}
