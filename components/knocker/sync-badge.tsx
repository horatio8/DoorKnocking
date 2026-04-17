"use client";

import { useEffect } from "react";
import { CloudOff, CloudUpload, Check } from "lucide-react";
import { useFieldStore } from "@/lib/offline/store";
import { startSyncWorker } from "@/lib/offline/sync";

export function SyncBadge() {
  const pending = useFieldStore((s) => s.pendingCount);
  const online = useFieldStore((s) => s.online);
  const setOnline = useFieldStore((s) => s.setOnline);
  const refresh = useFieldStore((s) => s.refreshPendingCount);

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

  if (!online) {
    return (
      <span className="flex items-center gap-1 rounded-full bg-white/10 px-2 py-1 text-xs">
        <CloudOff className="h-3.5 w-3.5" /> Offline · {pending} queued
      </span>
    );
  }
  if (pending > 0) {
    return (
      <span className="flex items-center gap-1 rounded-full bg-white/10 px-2 py-1 text-xs">
        <CloudUpload className="h-3.5 w-3.5" /> {pending} to sync
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 rounded-full bg-white/10 px-2 py-1 text-xs">
      <Check className="h-3.5 w-3.5" /> In sync
    </span>
  );
}
