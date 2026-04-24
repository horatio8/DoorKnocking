"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Lock, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AttachItem {
  id: string;
  name: string;
  status?: string | null;
}

// Reusable attach/unattach card for walkbook → surveys and walkbook →
// scripts. Same shape on both endpoints (PUT with { ids, pinnedId? }) so
// the card just swaps entity names.

export function WalkbookAttachments({
  walkbookId,
  entity,
  available,
  initial,
}: {
  walkbookId: string;
  entity: "surveys" | "scripts";
  available: AttachItem[];
  initial: { ids: string[]; pinnedId: string | null };
}) {
  const router = useRouter();
  const [ids, setIds] = useState<Set<string>>(new Set(initial.ids));
  const [pinnedId, setPinnedId] = useState<string | null>(initial.pinnedId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // If the admin unchecks the pinned row (or has more than one selected),
  // auto-clear the pin so we never send a PUT that fails validation.
  useEffect(() => {
    if (!pinnedId) return;
    if (!ids.has(pinnedId) || ids.size !== 1) setPinnedId(null);
  }, [ids, pinnedId]);

  function toggle(id: string) {
    setIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/walkbooks/${walkbookId}/${entity}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(ids), pinnedId }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `${res.status}`);
      setNotice("Saved.");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const label = entity === "surveys" ? "Surveys" : "Scripts";
  const lockHint = ids.size === 1
    ? "Lock this single attachment so volunteers can't switch at the door."
    : "Lock requires exactly one attached item.";

  return (
    <div className="rounded-lg border border-border bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-navy-900">{label} on this walkbook</p>
          <p className="text-xs text-muted-foreground">
            {ids.size === 0
              ? `No ${entity} attached — volunteers fall back to the district default.`
              : `${ids.size} attached${pinnedId ? " · locked" : ""}`}
          </p>
        </div>
        <Button onClick={save} disabled={saving} variant="accent" size="sm">
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>

      {available.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
          No active {entity} in this district yet.
        </p>
      ) : (
        <ul className="grid gap-1.5">
          {available.map((a) => {
            const selected = ids.has(a.id);
            const pinned = pinnedId === a.id;
            return (
              <li
                key={a.id}
                className={`flex items-center gap-2 rounded-md border p-2 ${
                  selected ? "border-navy-900 bg-navy-50/40" : "border-border bg-white"
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggle(a.id)}
                  className={`flex h-6 w-6 flex-none items-center justify-center rounded border ${
                    selected
                      ? "border-navy-900 bg-navy-900 text-white"
                      : "border-navy-200 bg-white text-navy-400"
                  }`}
                  aria-label={selected ? "Unselect" : "Select"}
                >
                  {selected ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                </button>
                <span className="flex-1 text-sm text-navy-900">{a.name}</span>
                {a.status ? (
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    {a.status}
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => setPinnedId(pinned ? null : a.id)}
                  disabled={!selected || (ids.size > 1 && !pinned)}
                  title={lockHint}
                  className={`flex h-7 items-center gap-1 rounded-full border px-2 text-[11px] font-semibold ${
                    pinned
                      ? "border-oxblood bg-oxblood text-white"
                      : "border-navy-200 bg-white text-navy-700 disabled:opacity-40"
                  }`}
                >
                  <Lock className="h-3 w-3" /> {pinned ? "Locked" : "Lock"}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {error ? (
        <p className="mt-3 rounded bg-crimson/10 px-3 py-2 text-xs text-crimson">{error}</p>
      ) : null}
      {notice ? (
        <p className="mt-3 rounded bg-emerald-100 px-3 py-2 text-xs text-emerald-800">{notice}</p>
      ) : null}
    </div>
  );
}
