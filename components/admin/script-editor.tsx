"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, CheckCircle2, PauseCircle, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type Status = "draft" | "active" | "paused" | "archived";

// Minimal script editor — name, priority, markdown body, publish/pause/
// archive from the header. No template system; scripts are usually short
// and admins paste them in.

export function ScriptEditor({
  id,
  initial,
}: {
  id: string;
  initial: { name: string; body_md: string; priority: number; status: Status };
}) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [priority, setPriority] = useState(initial.priority);
  const [body, setBody] = useState(initial.body_md);
  const [status, setStatus] = useState<Status>(initial.status);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(nextStatus?: Status) {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/scripts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          priority,
          body_md: body,
          ...(nextStatus ? { status: nextStatus } : {}),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? `${res.status}`);
      if (nextStatus) setStatus(nextStatus);
      setNotice("Saved.");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href="/admin/scripts"
            className="inline-flex items-center gap-1 text-xs text-navy-700 hover:text-navy-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> All scripts
          </Link>
          <h1 className="mt-1 font-serif text-2xl font-semibold text-navy-900">
            {name || "Untitled script"}
          </h1>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <StatusBadge status={status} /> <span>priority {priority}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {status !== "active" ? (
            <Button onClick={() => save("active")} disabled={saving} variant="accent">
              <CheckCircle2 className="mr-1.5 h-4 w-4" /> Publish
            </Button>
          ) : null}
          {status === "active" ? (
            <Button onClick={() => save("paused")} disabled={saving} variant="outline">
              <PauseCircle className="mr-1.5 h-4 w-4" /> Pause
            </Button>
          ) : null}
          {status !== "archived" ? (
            <Button onClick={() => save("archived")} disabled={saving} variant="ghost">
              <Archive className="mr-1.5 h-4 w-4" /> Archive
            </Button>
          ) : null}
          <Button onClick={() => save()} disabled={saving} variant="outline">
            <Save className="mr-1.5 h-4 w-4" /> Save
          </Button>
        </div>
      </div>

      {notice ? (
        <p className="rounded bg-emerald-100 px-3 py-2 text-xs text-emerald-800">{notice}</p>
      ) : null}
      {error ? (
        <p className="rounded bg-crimson/10 px-3 py-2 text-xs text-crimson">{error}</p>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        <section className="rounded-lg border border-border bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-navy-500">Metadata</p>
          <label className="mt-3 block text-xs">
            <span className="block font-medium text-navy-500">Name</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="mt-3 block text-xs">
            <span className="block font-medium text-navy-500">Priority</span>
            <Input
              type="number"
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value) || 0)}
            />
          </label>
          <p className="mt-4 text-[11px] text-muted-foreground">
            Scripts with higher priority render first in the walkbook preview picker.
          </p>
        </section>

        <section className="rounded-lg border border-border bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-navy-500">Body</p>
          <p className="text-[11px] text-muted-foreground">
            Plain text or markdown — volunteers see this as a collapsible disclosure on the
            walkbook preview.
          </p>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={18}
            className="mt-2 w-full rounded-md border border-navy-200 p-3 font-mono text-sm"
            placeholder={`Hi, I'm {{volunteer_name}} with the {{campaign_name}} campaign.\n\nI wanted to ask what issues matter most to you in the upcoming election.`}
          />
        </section>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: Status }) {
  if (status === "active") return <Badge variant="success">Active</Badge>;
  if (status === "paused") return <Badge variant="warning">Paused</Badge>;
  if (status === "archived") return <Badge variant="secondary">Archived</Badge>;
  return <Badge variant="secondary">Draft</Badge>;
}
