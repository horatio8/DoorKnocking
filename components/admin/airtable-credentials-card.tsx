"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRelative } from "@/lib/utils";

interface Props {
  clientId: string;
  clientName: string;
  hasToken: boolean;
  workspaceId: string | null;
  verifiedAt: string | null;
}

export function AirtableCredentialsCard(props: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(!props.hasToken);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function save() {
    setBusy("Verifying…");
    setError(null);
    setNotice(null);
    const res = await fetch("/api/admin/settings/airtable", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: token.trim() }),
    });
    setBusy(null);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? `${res.status}`);
      return;
    }
    setToken("");
    setEditing(false);
    setNotice(`Verified — ${body.base_count} base(s) reachable with this token.`);
    router.refresh();
  }

  async function remove() {
    if (!confirm(`Remove the Airtable token for ${props.clientName}?`)) return;
    setBusy("Removing…");
    setError(null);
    const res = await fetch("/api/admin/settings/airtable", { method: "DELETE" });
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
      <CardHeader>
        <CardTitle>Airtable</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Personal Access Token used for every Airtable operation by this client. We never display
          the token again after saving. Rotate or revoke in Airtable; paste the new value here.
        </p>

        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">Status:</span>
          {props.hasToken ? (
            <Badge variant="success">Stored</Badge>
          ) : (
            <Badge variant="secondary">Not set</Badge>
          )}
          {props.verifiedAt ? (
            <span className="text-xs text-muted-foreground">
              verified {formatRelative(props.verifiedAt)}
            </span>
          ) : null}
        </div>

        {editing ? (
          <div className="space-y-2">
            <Input
              type="password"
              placeholder="patXXXX.XXXXXXXXXXXXX"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              Token must have scopes <code>data.records:read</code>,{" "}
              <code>data.records:write</code>, <code>schema.bases:read</code>, and access to the
              base(s) for this client.
            </p>
            <div className="flex gap-2">
              <Button onClick={save} disabled={!token || !!busy}>
                {busy ?? "Save & verify"}
              </Button>
              {props.hasToken ? (
                <Button type="button" variant="ghost" onClick={() => { setEditing(false); setToken(""); }}>
                  Cancel
                </Button>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setEditing(true)}>
              Replace token
            </Button>
            <Button variant="ghost" onClick={remove} disabled={!!busy}>
              Remove
            </Button>
          </div>
        )}

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
