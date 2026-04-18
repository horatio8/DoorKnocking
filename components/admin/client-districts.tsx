"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface DistrictRow {
  id: string;
  slug: string;
  name: string;
  country: string;
  region: string;
  timezone: string;
  active: boolean;
  airtable_base_id: string | null;
  airtable_voters_table_id: string | null;
  airtable_import_status: string | null;
}

interface Props {
  clientId: string;
  clientName: string;
  districts: DistrictRow[];
}

function normalizeSlug(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

const INITIAL_NEW = {
  slug: "",
  name: "",
  country: "US",
  region: "",
  timezone: "America/New_York",
};

export function ClientDistricts({ clientId, clientName, districts }: Props) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(INITIAL_NEW);

  async function createDistrict(e: React.FormEvent) {
    e.preventDefault();
    setBusy("Creating…");
    setError(null);
    const res = await fetch(`/api/admin/clients/${clientId}/districts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(body.error ?? `${res.status}`);
      return;
    }
    setForm(INITIAL_NEW);
    setAdding(false);
    router.refresh();
  }

  async function toggleActive(d: DistrictRow) {
    setBusy(`${d.active ? "Deactivating" : "Activating"} ${d.name}…`);
    setError(null);
    const res = await fetch(`/api/admin/clients/${clientId}/districts/${d.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !d.active }),
    });
    setBusy(null);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? `${res.status}`);
      return;
    }
    router.refresh();
  }

  async function removeDistrict(d: DistrictRow) {
    if (
      !confirm(
        `Delete district "${d.name}"? This is permanent and will fail if voters/walkbooks reference it — deactivate instead if unsure.`,
      )
    )
      return;
    setBusy(`Deleting ${d.name}…`);
    setError(null);
    const res = await fetch(`/api/admin/clients/${clientId}/districts/${d.id}`, {
      method: "DELETE",
    });
    setBusy(null);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? `${res.status}`);
      return;
    }
    router.refresh();
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Districts</CardTitle>
        {!adding ? (
          <Button variant="outline" onClick={() => setAdding(true)}>
            Add district
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Each district is a separate voter universe for <strong>{clientName}</strong>, with its
          own Airtable connection and walkbooks. Deactivate a district to hide it from dashboards
          without deleting data.
        </p>

        {adding ? (
          <form
            onSubmit={createDistrict}
            className="grid gap-2 rounded-md border border-navy-100 bg-navy-50/30 p-3 md:grid-cols-2"
          >
            <Input
              required
              placeholder="slug (e.g. sc-hd-115) — lowercase only"
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: normalizeSlug(e.target.value) })}
            />
            <Input
              required
              placeholder="District name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <Input
              required
              placeholder="Country (US, AU)"
              value={form.country}
              onChange={(e) => setForm({ ...form, country: e.target.value })}
            />
            <Input
              required
              placeholder="Region (state / electorate)"
              value={form.region}
              onChange={(e) => setForm({ ...form, region: e.target.value })}
            />
            <Input
              placeholder="Timezone"
              value={form.timezone}
              onChange={(e) => setForm({ ...form, timezone: e.target.value })}
            />
            <div className="flex items-center gap-2 md:col-span-2">
              <Button type="submit" disabled={!!busy}>
                {busy ?? "Create district"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setAdding(false);
                  setForm(INITIAL_NEW);
                }}
              >
                Cancel
              </Button>
              <span className="text-xs text-muted-foreground">
                Connect its Airtable in the next step.
              </span>
            </div>
          </form>
        ) : null}

        {districts.length === 0 ? (
          <p className="rounded-md border border-dashed border-border bg-white p-4 text-sm text-muted-foreground">
            No districts yet. Add one to start importing voters.
          </p>
        ) : (
          <div className="overflow-hidden rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="bg-navy-50 text-xs uppercase tracking-widest text-navy-700">
                <tr>
                  <th className="px-3 py-2 text-left">Slug</th>
                  <th className="px-3 py-2 text-left">Name</th>
                  <th className="px-3 py-2 text-left">Region</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Airtable</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {districts.map((d) => (
                  <tr key={d.id} className="border-t border-border">
                    <td className="px-3 py-2 font-mono text-xs">{d.slug}</td>
                    <td className="px-3 py-2">{d.name}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {d.region}
                      {d.country ? ` · ${d.country}` : ""}
                    </td>
                    <td className="px-3 py-2">
                      {d.active ? (
                        <Badge variant="success">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <AirtableStatusBadge status={d.airtable_import_status} />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="inline-flex items-center gap-1">
                        <Link
                          href={`/admin/airtable?district=${d.id}`}
                          className="rounded-md border border-navy-200 bg-white px-2 py-1 text-xs font-medium text-navy-700 hover:bg-navy-50"
                        >
                          Airtable
                        </Link>
                        <button
                          type="button"
                          className="rounded-md border border-navy-200 bg-white px-2 py-1 text-xs font-medium text-navy-700 hover:bg-navy-50 disabled:opacity-50"
                          onClick={() => toggleActive(d)}
                          disabled={!!busy}
                        >
                          {d.active ? "Deactivate" : "Activate"}
                        </button>
                        <button
                          type="button"
                          className="rounded-md px-2 py-1 text-xs font-medium text-crimson hover:bg-crimson/10 disabled:opacity-50"
                          onClick={() => removeDistrict(d)}
                          disabled={!!busy}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {error ? (
          <p className="rounded bg-crimson/10 px-3 py-2 text-xs text-crimson">{error}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function AirtableStatusBadge({ status }: { status: string | null }) {
  switch (status) {
    case "ready":
      return <Badge variant="success">Ready</Badge>;
    case "importing":
      return <Badge variant="warning">Importing…</Badge>;
    case "error":
      return <Badge variant="destructive">Error</Badge>;
    case "mapping_pending":
      return <Badge variant="warning">Mapping pending</Badge>;
    default:
      return <Badge variant="secondary">Unconfigured</Badge>;
  }
}
