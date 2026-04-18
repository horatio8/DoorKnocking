"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface FormState {
  slug: string;
  name: string;
  contact_email: string;
  short_name: string;
  primary_color: string;
  accent_color: string;
  district_slug: string;
  district_name: string;
  district_region: string;
  district_country: string;
  airtable_base_id: string;
  airtable_voters_table_id: string;
  airtable_token: string;
  airtable_workspace_id: string;
  timezone: string;
}

function normalizeSlug(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

const INITIAL: FormState = {
  slug: "",
  name: "",
  contact_email: "",
  short_name: "",
  primary_color: "#0B1F3A",
  accent_color: "#B5121B",
  district_slug: "",
  district_name: "",
  district_region: "",
  district_country: "US",
  airtable_base_id: "",
  airtable_voters_table_id: "",
  airtable_token: "",
  airtable_workspace_id: "",
  timezone: "America/New_York",
};

export function CreateClientForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(INITIAL);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? `Failed (${res.status})`);
      return;
    }
    setForm(INITIAL);
    setOpen(false);
    router.refresh();
  }

  if (!open) return <Button variant="accent" onClick={() => setOpen(true)}>New client</Button>;

  return (
    <form
      className="grid gap-3 rounded-md border border-navy-100 bg-white p-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <h2 className="text-sm font-semibold uppercase tracking-widest text-navy-700">New client</h2>

      <div className="grid gap-2 md:grid-cols-2">
        <Input
          required
          placeholder="slug (e.g. macarthur) — lowercase only"
          value={form.slug}
          onChange={(e) => setForm({ ...form, slug: normalizeSlug(e.target.value) })}
        />
        <Input required placeholder="Client name"
          value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <Input placeholder="Contact email"
          value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} />
        <Input placeholder="Short name (in-app header)"
          value={form.short_name} onChange={(e) => setForm({ ...form, short_name: e.target.value })} />
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Primary color
          <input type="color" value={form.primary_color}
            onChange={(e) => setForm({ ...form, primary_color: e.target.value })}
            className="h-8 w-12 cursor-pointer border-0 bg-transparent" />
        </label>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Accent color
          <input type="color" value={form.accent_color}
            onChange={(e) => setForm({ ...form, accent_color: e.target.value })}
            className="h-8 w-12 cursor-pointer border-0 bg-transparent" />
        </label>
      </div>

      <h3 className="mt-2 text-xs font-semibold uppercase tracking-widest text-navy-700">
        Airtable credentials (optional — can be added later from Settings)
      </h3>
      <div className="grid gap-2 md:grid-cols-2">
        <Input placeholder="Airtable PAT (patXXXX.XXXXX…)" type="password" autoComplete="off"
          value={form.airtable_token} onChange={(e) => setForm({ ...form, airtable_token: e.target.value })} />
        <Input placeholder="Airtable workspace id (optional)"
          value={form.airtable_workspace_id} onChange={(e) => setForm({ ...form, airtable_workspace_id: e.target.value })} />
      </div>
      <p className="-mt-1 text-xs text-muted-foreground">
        Token will be verified against Airtable before the client is created. Needs scopes:
        <code className="mx-1">data.records:read</code>
        <code className="mx-1">data.records:write</code>
        <code className="mx-1">schema.bases:read</code>
      </p>

      <h3 className="mt-2 text-xs font-semibold uppercase tracking-widest text-navy-700">
        First district
      </h3>
      <div className="grid gap-2 md:grid-cols-2">
        <Input
          required
          placeholder="District slug (must be globally unique)"
          value={form.district_slug}
          onChange={(e) => setForm({ ...form, district_slug: normalizeSlug(e.target.value) })}
        />
        <Input required placeholder="District name"
          value={form.district_name} onChange={(e) => setForm({ ...form, district_name: e.target.value })} />
        <Input required placeholder="Country (US, AU)"
          value={form.district_country} onChange={(e) => setForm({ ...form, district_country: e.target.value })} />
        <Input required placeholder="Region (state/electorate)"
          value={form.district_region} onChange={(e) => setForm({ ...form, district_region: e.target.value })} />
        <Input placeholder="Airtable base id (app…)"
          value={form.airtable_base_id} onChange={(e) => setForm({ ...form, airtable_base_id: e.target.value })} />
        <Input placeholder="Airtable voters table id (tbl…)"
          value={form.airtable_voters_table_id} onChange={(e) => setForm({ ...form, airtable_voters_table_id: e.target.value })} />
        <Input placeholder="Timezone"
          value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} />
      </div>

      {error ? <p className="text-xs text-crimson">{error}</p> : null}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={busy}>
          {busy ? "Creating…" : "Create client"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => { setOpen(false); setForm(INITIAL); }}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
