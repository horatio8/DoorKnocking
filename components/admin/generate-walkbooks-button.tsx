"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function GenerateWalkbooksButton({ districtId }: { districtId: string }) {
  const router = useRouter();
  const [size, setSize] = useState(20);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handle() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/walkbooks/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ districtId, targetSize: size }),
      });
      if (!res.ok) throw new Error(`Generate failed: ${res.status}`);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-muted-foreground">
        Size:
        <input
          type="number"
          min={5}
          max={80}
          value={size}
          onChange={(e) => setSize(Number(e.target.value))}
          className="ml-1 w-16 rounded border border-input px-2 py-1 text-sm"
        />
      </label>
      <Button onClick={handle} disabled={busy} variant="accent">
        {busy ? "Generating…" : "Auto-generate walkbooks"}
      </Button>
      {error ? <span className="text-xs text-crimson">{error}</span> : null}
    </div>
  );
}
