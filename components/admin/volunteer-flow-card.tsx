"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  clientId: string;
  clientName: string;
  initialEnabled: boolean;
}

// Toggles the rebuilt /v volunteer flow for this client. Knockers under the
// client are routed to /v/welcome when this is on; to legacy /app/map when
// off. A `v_flow=on` cookie still overrides per-tester regardless.

export function VolunteerFlowCard({ clientId, clientName, initialEnabled }: Props) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const onToggle = async (next: boolean) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/clients/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ use_v_flow: next }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Couldn't update the setting.");
      }
      setEnabled(next);
      setNotice(
        next
          ? `${clientName} knockers will now use the new field app.`
          : `${clientName} knockers will use the legacy field app.`,
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold text-navy-900">Volunteer field app</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          When on, knockers see the rebuilt voter-queue flow at <code>/v</code> after they sign in.
          When off, they get the legacy walkbook flow at <code>/app/map</code>. New clients default
          to the new flow; this toggle lets you flip back if needed.
        </p>

        <div className="flex items-center justify-between rounded-md border border-border p-3">
          <div>
            <div className="text-sm font-medium text-navy-900">
              New flow {enabled ? "on" : "off"}
            </div>
            <div className="text-xs text-muted-foreground">
              {enabled
                ? "Knockers land on /v/welcome after signing in."
                : "Knockers land on /app/map after signing in."}
            </div>
          </div>
          <Button
            type="button"
            variant={enabled ? "outline" : "primary"}
            disabled={busy}
            onClick={() => onToggle(!enabled)}
          >
            {busy ? "Saving…" : enabled ? "Turn off" : "Turn on"}
          </Button>
        </div>

        {notice ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            {notice}
          </div>
        ) : null}
        {error ? (
          <div className="rounded-md border border-crimson/30 bg-crimson/5 px-3 py-2 text-xs text-crimson">
            {error}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
