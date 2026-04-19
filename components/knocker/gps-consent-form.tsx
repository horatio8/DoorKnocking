"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, ShieldCheck, Eye, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";

// Plain-English GPS consent screen (DOORKNOCKER.md §10.1). Volunteers can
// decline; paid canvassers must allow (button is disabled otherwise).
export function GpsConsentForm({ paidCanvasser }: { paidCanvasser: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"allow" | "decline" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function persist(consent: boolean) {
    setBusy(consent ? "allow" : "decline");
    setError(null);
    try {
      const res = await fetch("/api/knocker/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gps_consent: consent,
          gps_consent_version: "v1",
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? `${res.status}`);
      router.replace("/app/walkbooks/browse");
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  }

  async function allow() {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      await persist(true);
      return;
    }
    // Ask the browser for a fix to prime the permission. We don't block on it —
    // the row still saves either way, but we warm up the permission prompt.
    navigator.geolocation.getCurrentPosition(
      () => persist(true),
      () => persist(true),
      { maximumAge: 60000, timeout: 5000, enableHighAccuracy: false },
    );
  }

  return (
    <div className="mx-auto flex h-full max-w-md flex-col p-4">
      <p className="text-xs uppercase tracking-widest text-navy-500">Location permission</p>
      <h1 className="mt-1 font-serif text-2xl font-semibold text-navy-900">
        Can we see where you are while you&apos;re knocking?
      </h1>

      <div className="mt-4 space-y-3 rounded-lg border border-border bg-white p-4 text-sm text-navy-900">
        <Row icon={<MapPin className="h-4 w-4" />}>
          We use your location to show you the next house and record that you actually visited
          each address.
        </Row>
        <Row icon={<Timer className="h-4 w-4" />}>
          It&apos;s only on while a knock session is running. We stop tracking when you finish.
        </Row>
        <Row icon={<Eye className="h-4 w-4" />}>
          Only your campaign admins can see the trail — we don&apos;t sell it, share it, or use it
          outside this app.
        </Row>
        <Row icon={<ShieldCheck className="h-4 w-4" />}>
          You can revoke this at any time from the &ldquo;My Day&rdquo; screen.
        </Row>
      </div>

      {paidCanvasser ? (
        <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          You&apos;re marked as a paid canvasser on this campaign, which means GPS tracking is
          required for your hours to count.
        </p>
      ) : null}

      {error ? (
        <p className="mt-2 rounded bg-crimson/10 px-3 py-2 text-xs text-crimson">{error}</p>
      ) : null}

      <div className="mt-4 flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          onClick={() => persist(false)}
          disabled={paidCanvasser || busy !== null}
          title={paidCanvasser ? "Paid canvassers must allow GPS" : "Skip for now"}
        >
          {busy === "decline" ? "Saving…" : "Not now"}
        </Button>
        <Button onClick={allow} disabled={busy !== null} variant="accent">
          {busy === "allow" ? "Saving…" : "Allow location"}
        </Button>
      </div>
    </div>
  );
}

function Row({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 text-navy-600">{icon}</span>
      <p>{children}</p>
    </div>
  );
}
