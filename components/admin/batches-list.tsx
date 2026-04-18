"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Undo2 } from "lucide-react";

interface BatchRow {
  id: string;
  district: string;
  method: string;
  walkbookCount: number;
  volunteerCount: number;
  totalDurationMinutes: number;
  totalDoors: number;
  notes: string | null;
  undoneAt: string | null;
  createdAt: string;
  createdAtRelative: string;
  createdBy: string | null;
}

export function BatchesList({ batches }: { batches: BatchRow[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function undo(id: string) {
    if (!confirm("Undo this batch? Every assignment in it will be closed.")) return;
    setBusyId(id);
    setError(null);
    const res = await fetch(`/api/walkbooks/assign/batch/${id}`, { method: "DELETE" });
    setBusyId(null);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? `${res.status}`);
      return;
    }
    router.refresh();
  }

  if (batches.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border bg-white p-8 text-center text-sm text-muted-foreground">
        No assignment batches yet. Head to{" "}
        <a className="underline" href="/admin/walkbooks/assign">
          /admin/walkbooks/assign
        </a>{" "}
        to distribute work.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error ? (
        <p className="rounded bg-crimson/10 px-3 py-2 text-xs text-crimson">{error}</p>
      ) : null}
      <div className="overflow-hidden rounded-lg border border-border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-navy-50 text-xs uppercase tracking-widest text-navy-700">
            <tr>
              <th className="px-3 py-2 text-left">When</th>
              <th className="px-3 py-2 text-left">District</th>
              <th className="px-3 py-2 text-left">Method</th>
              <th className="px-3 py-2 text-left">By</th>
              <th className="px-3 py-2 text-left">Scope</th>
              <th className="px-3 py-2 text-left">Notes</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {batches.map((b) => (
              <tr key={b.id} className="border-t border-border">
                <td className="px-3 py-2 text-xs text-muted-foreground">{b.createdAtRelative}</td>
                <td className="px-3 py-2">{b.district}</td>
                <td className="px-3 py-2 capitalize">{b.method}</td>
                <td className="px-3 py-2 text-xs">{b.createdBy ?? "—"}</td>
                <td className="px-3 py-2 text-xs">
                  {b.walkbookCount} walkbooks · {b.volunteerCount} volunteers ·{" "}
                  {Math.floor(b.totalDurationMinutes / 60)}h {b.totalDurationMinutes % 60}m ·{" "}
                  {b.totalDoors} doors
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{b.notes ?? "—"}</td>
                <td className="px-3 py-2 text-right">
                  {b.undoneAt ? (
                    <Badge variant="secondary">Undone</Badge>
                  ) : (
                    <button
                      type="button"
                      onClick={() => undo(b.id)}
                      disabled={busyId === b.id}
                      className="inline-flex items-center gap-1 rounded-md border border-navy-200 bg-white px-2 py-1 text-xs font-medium text-navy-700 hover:bg-navy-50 disabled:opacity-40"
                    >
                      <Undo2 className="h-3 w-3" /> Undo
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
