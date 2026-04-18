"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface ClientDetails {
  id: string;
  slug: string;
  name: string;
  contact_email: string | null;
  active: boolean;
  brand: {
    short_name?: string;
    primary_color?: string;
    accent_color?: string;
    logo_url?: string;
  } | null;
}

interface Props {
  client: ClientDetails;
}

function normalizeSlug(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function ClientDetailsCard({ client }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: client.name,
    slug: client.slug,
    contact_email: client.contact_email ?? "",
    short_name: client.brand?.short_name ?? "",
    primary_color: client.brand?.primary_color ?? "#0B1F3A",
    accent_color: client.brand?.accent_color ?? "#B5121B",
  });
  const [deleteConfirm, setDeleteConfirm] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy("Saving…");
    setError(null);
    setNotice(null);
    const res = await fetch(`/api/admin/clients/${client.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        slug: form.slug,
        contact_email: form.contact_email,
        brand: {
          short_name: form.short_name || form.name,
          primary_color: form.primary_color,
          accent_color: form.accent_color,
        },
      }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(body.error ?? `${res.status}`);
      return;
    }
    setNotice("Saved.");
    setEditing(false);
    // if slug changed, route to the new URL
    if (body.client?.slug && body.client.slug !== client.slug) {
      router.push(`/admin/clients/${body.client.slug}/settings`);
    } else {
      router.refresh();
    }
  }

  async function toggleActive() {
    setBusy(client.active ? "Deactivating…" : "Activating…");
    setError(null);
    const res = await fetch(`/api/admin/clients/${client.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !client.active }),
    });
    setBusy(null);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? `${res.status}`);
      return;
    }
    router.refresh();
  }

  async function deleteClient() {
    setBusy("Deleting…");
    setError(null);
    const res = await fetch(
      `/api/admin/clients/${client.id}?confirmSlug=${encodeURIComponent(client.slug)}`,
      { method: "DELETE" },
    );
    const body = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(body.error ?? `${res.status}`);
      return;
    }
    router.push("/admin/clients");
  }

  const deleteArmed = deleteConfirm === client.slug;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Client details</CardTitle>
        {!editing ? (
          <div className="flex items-center gap-2">
            {client.active ? (
              <Badge variant="success">Active</Badge>
            ) : (
              <Badge variant="secondary">Paused</Badge>
            )}
            <Button variant="outline" onClick={() => setEditing(true)}>
              Edit
            </Button>
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        {!editing ? (
          <dl className="grid gap-2 text-sm md:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-widest text-muted-foreground">Name</dt>
              <dd>{client.name}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-widest text-muted-foreground">Slug</dt>
              <dd className="font-mono text-xs">{client.slug}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-widest text-muted-foreground">Contact email</dt>
              <dd>{client.contact_email ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-widest text-muted-foreground">Short name</dt>
              <dd>{client.brand?.short_name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-widest text-muted-foreground">Colors</dt>
              <dd className="flex items-center gap-2">
                <span
                  className="inline-block h-4 w-4 rounded border border-border"
                  style={{ backgroundColor: client.brand?.primary_color ?? "#0B1F3A" }}
                />
                <span className="font-mono text-xs">{client.brand?.primary_color ?? "#0B1F3A"}</span>
                <span
                  className="inline-block h-4 w-4 rounded border border-border"
                  style={{ backgroundColor: client.brand?.accent_color ?? "#B5121B" }}
                />
                <span className="font-mono text-xs">{client.brand?.accent_color ?? "#B5121B"}</span>
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-widest text-muted-foreground">Subdomain</dt>
              <dd className="font-mono text-xs">{client.slug}.campaignos.com</dd>
            </div>
          </dl>
        ) : (
          <form onSubmit={save} className="grid gap-2 md:grid-cols-2">
            <Input
              required
              placeholder="Client name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <Input
              required
              placeholder="slug"
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: normalizeSlug(e.target.value) })}
            />
            <Input
              placeholder="Contact email"
              value={form.contact_email}
              onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
            />
            <Input
              placeholder="Short name (in-app header)"
              value={form.short_name}
              onChange={(e) => setForm({ ...form, short_name: e.target.value })}
            />
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              Primary color
              <input
                type="color"
                value={form.primary_color}
                onChange={(e) => setForm({ ...form, primary_color: e.target.value })}
                className="h-8 w-12 cursor-pointer border-0 bg-transparent"
              />
            </label>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              Accent color
              <input
                type="color"
                value={form.accent_color}
                onChange={(e) => setForm({ ...form, accent_color: e.target.value })}
                className="h-8 w-12 cursor-pointer border-0 bg-transparent"
              />
            </label>
            <div className="flex items-center gap-2 md:col-span-2">
              <Button type="submit" disabled={!!busy}>
                {busy ?? "Save"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setEditing(false);
                  setError(null);
                  setForm({
                    name: client.name,
                    slug: client.slug,
                    contact_email: client.contact_email ?? "",
                    short_name: client.brand?.short_name ?? "",
                    primary_color: client.brand?.primary_color ?? "#0B1F3A",
                    accent_color: client.brand?.accent_color ?? "#B5121B",
                  });
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}

        {!editing ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={toggleActive} disabled={!!busy}>
              {busy ?? (client.active ? "Deactivate client" : "Activate client")}
            </Button>
          </div>
        ) : null}

        <div className="rounded-md border border-crimson/30 bg-crimson/5 p-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-crimson">
            Danger zone
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Deleting this client also deletes all of its districts. Voters, walkbooks, and users
            that reference it will block the delete with a foreign-key error — deactivate instead
            if unsure.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Input
              placeholder={`Type "${client.slug}" to confirm`}
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              className="max-w-xs"
            />
            <Button
              type="button"
              variant="ghost"
              onClick={deleteClient}
              disabled={!deleteArmed || !!busy}
              className="text-crimson hover:bg-crimson/10 disabled:opacity-40"
            >
              {busy === "Deleting…" ? busy : "Delete client"}
            </Button>
          </div>
        </div>

        {error ? (
          <p className="rounded bg-crimson/10 px-3 py-2 text-xs text-crimson">{error}</p>
        ) : null}
        {notice ? (
          <p className="rounded bg-emerald-100 px-3 py-2 text-xs text-emerald-800">{notice}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
