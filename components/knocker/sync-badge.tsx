"use client";

import { useEffect, useState } from "react";
import { CloudOff, CloudUpload, Check, RefreshCcw } from "lucide-react";
import { useFieldStore } from "@/lib/offline/store";
import { startSyncWorker, flushOutbox } from "@/lib/offline/sync";

export function SyncBadge() {
  const pending = useFieldStore((s) => s.pendingCount);
  const online = useFieldStore((s) => s.online);
  const setOnline = useFieldStore((s) => s.setOnline);
  const refresh = useFieldStore((s) => s.refreshPendingCount);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    startSyncWorker();
    refresh();
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    const interval = setInterval(refresh, 5000);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      clearInterval(interval);
    };
  }, [refresh, setOnline]);

  // Tap the badge when pending > 0 to force a flush. If entries have
  // exhausted their retry budget the sync worker prunes them and logs the
  // cause to the devtools console, then the count drops to zero.
  async function forceFlush() {
    if (busy) return;
    setBusy(true);
    const result = await flushOutbox().catch(() => ({ flushed: 0, failed: 0, pruned: 0 }));
    await refresh();
    setBusy(false);
    console.info("[outbox] manual flush", result);
  }

  const base =
    "flex items-center gap-1 rounded-full bg-white/10 px-2 py-1 text-xs transition hover:bg-white/20";

  if (!online) {
    return (
      <span className={base}>
        <CloudOff className="h-3.5 w-3.5" /> Offline · {pending} queued
      </span>
    );
  }
  if (pending > 0) {
    return (
      <button
        type="button"
        onClick={forceFlush}
        disabled={busy}
        className={base}
        aria-label="Retry pending sync"
        title="Tap to retry. Failures log to the devtools console; entries that never succeed are dropped after 10 tries."
      >
        {busy ? (
          <RefreshCcw className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <CloudUpload className="h-3.5 w-3.5" />
        )}{" "}
        {pending} to sync
      </button>
    );
  }
  return (
    <span className={base}>
      <Check className="h-3.5 w-3.5" /> In sync
    </span>
  );
}
