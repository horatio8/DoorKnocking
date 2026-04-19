"use client";

// Lightweight wrapper for geolocation.watchPosition + periodic ping upload.
// Used by the map/knocker shell while a knock session is active.

interface PingQueueEntry {
  lat: number;
  lng: number;
  accuracy_meters: number | null;
  recorded_at: string;
  session_id: string | null;
}

export class GpsPinger {
  private watchId: number | null = null;
  private queue: PingQueueEntry[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private readonly sessionId: string | null;
  private readonly intervalMs: number;

  constructor(sessionId: string | null, intervalMs = 15_000) {
    this.sessionId = sessionId;
    this.intervalMs = intervalMs;
  }

  start() {
    if (typeof window === "undefined" || !("geolocation" in navigator)) return;
    this.watchId = navigator.geolocation.watchPosition(
      (pos) => this.enqueue(pos.coords),
      () => {}, // ignore transient errors; watch continues
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 },
    );
    this.flushTimer = setInterval(() => this.flush().catch(() => {}), this.intervalMs);
  }

  stop() {
    if (this.watchId != null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    void this.flush().catch(() => {});
  }

  private enqueue(coords: GeolocationCoordinates) {
    if (!Number.isFinite(coords.latitude) || !Number.isFinite(coords.longitude)) return;
    this.queue.push({
      lat: coords.latitude,
      lng: coords.longitude,
      accuracy_meters: coords.accuracy != null ? Math.round(coords.accuracy) : null,
      recorded_at: new Date().toISOString(),
      session_id: this.sessionId,
    });
  }

  private async flush() {
    if (this.queue.length === 0) return;
    const batch = this.queue.splice(0, this.queue.length);
    try {
      const res = await fetch("/api/knocker/gps-ping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pings: batch }),
        keepalive: true,
      });
      if (!res.ok) this.queue.unshift(...batch);
    } catch {
      // Network blip — requeue so the next flush retries.
      this.queue.unshift(...batch);
    }
  }
}
