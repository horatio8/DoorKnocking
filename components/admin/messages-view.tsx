"use client";

import { useState } from "react";
import { Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AdminMessagesView({ districts }: { districts: Array<{ id: string; name: string }> }) {
  const [districtId, setDistrictId] = useState<string>(districts[0]?.id ?? "");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function send() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/messages/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ districtId, subject: subject || undefined, body }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `${res.status}`);
      setNotice(`Broadcast sent to ${json.recipients} knocker${json.recipients === 1 ? "" : "s"}.`);
      setBody("");
      setSubject("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 p-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-navy-900">Messages</h1>
        <p className="text-sm text-muted-foreground">
          Send a campaign-wide broadcast to every knocker in a district.
        </p>
      </div>

      <section className="max-w-2xl space-y-3 rounded-lg border border-border bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-semibold text-navy-900">
          <Megaphone className="h-4 w-4" /> New broadcast
        </div>
        <label className="block text-xs">
          <span className="block font-semibold uppercase tracking-widest text-navy-500">District</span>
          <select
            value={districtId}
            onChange={(e) => setDistrictId(e.target.value)}
            className="mt-1 h-10 w-full rounded-md border border-input bg-white px-2 text-sm"
          >
            {districts.length === 0 ? <option value="">No districts available</option> : null}
            {districts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs">
          <span className="block font-semibold uppercase tracking-widest text-navy-500">Subject (optional)</span>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Saturday plans" />
        </label>
        <label className="block text-xs">
          <span className="block font-semibold uppercase tracking-widest text-navy-500">Message</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            className="mt-1 w-full rounded-md border border-navy-200 p-2 text-sm"
            placeholder="Write your message…"
          />
        </label>
        <div className="flex items-center gap-2">
          <Button onClick={send} disabled={busy || !body.trim() || !districtId} variant="accent">
            {busy ? "Sending…" : "Send broadcast"}
          </Button>
        </div>
        {error ? (
          <p className="rounded bg-crimson/10 px-3 py-2 text-xs text-crimson">{error}</p>
        ) : null}
        {notice ? (
          <p className="rounded bg-emerald-100 px-3 py-2 text-xs text-emerald-800">{notice}</p>
        ) : null}
      </section>
    </div>
  );
}
