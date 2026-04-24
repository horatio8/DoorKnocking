"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function NewScriptButton({
  districts,
  defaultDistrictId,
}: {
  districts: Array<{ id: string; name: string }>;
  defaultDistrictId: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [districtId, setDistrictId] = useState<string | null>(defaultDistrictId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (!name.trim() || !districtId) {
      setError("Name and district required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/scripts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ districtId, name: name.trim() }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `${res.status}`);
      router.push(`/admin/scripts/${body.id}/edit`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button variant="accent" onClick={() => setOpen(true)} disabled={districts.length === 0}>
        <Plus className="mr-1.5 h-4 w-4" /> New script
      </Button>
    );
  }
  return (
    <div className="w-full max-w-xl rounded-lg border border-navy-300 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-navy-900">New script</p>
        <button type="button" onClick={() => setOpen(false)} className="text-navy-400 hover:text-navy-700">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <label className="text-xs md:col-span-2">
          <span className="block font-semibold uppercase tracking-widest text-navy-500">Name</span>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Property-taxes opener" />
        </label>
        <label className="text-xs">
          <span className="block font-semibold uppercase tracking-widest text-navy-500">District</span>
          <select
            value={districtId ?? ""}
            onChange={(e) => setDistrictId(e.target.value || null)}
            className="mt-1 h-10 w-full rounded-md border border-input bg-white px-2 text-sm"
          >
            {districts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error ? (
        <p className="mt-3 rounded bg-crimson/10 px-3 py-2 text-xs text-crimson">{error}</p>
      ) : null}
      <div className="mt-3 flex items-center gap-2">
        <Button onClick={create} variant="accent" disabled={busy}>
          {busy ? "Creating…" : "Create draft"}
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
