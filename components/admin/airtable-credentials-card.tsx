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
  hasOAuth: boolean;
  oauthEnabled: boolean;
  workspaceId: string | null;
  verifiedAt: string | null;
  connectedAt: string | null;
}

export function AirtableCredentialsCard(props: Props) {
  const router = useRouter();
  const [showPatEditor, setShowPatEditor] = useState(!props.hasOAuth && !props.hasToken);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const connected = props.hasOAuth || props.hasToken;

  function connectOAuth() {
    const returnTo = typeof window !== "undefined" ? window.location.pathname : "/admin/settings";
    window.location.href = `/api/airtable/oauth/start?clientId=${encodeURIComponent(props.clientId)}&returnTo=${encodeURIComponent(returnTo)}`;
  }

  async function savePAT() {
    setBusy("Verifying…");
    setError(null);
    setNotice(null);
    const res = await fetch("/api/admin/settings/airtable", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: token.trim(), clientId: props.clientId }),
    });
    setBusy(null);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? `${res.status}`);
      return;
    }
    setToken("");
    setShowPatEditor(false);
    setNotice(`Verified — ${body.base_count} base(s) reachable with this token.`);
    router.refresh();
  }

  async function disconnect() {
    if (!confirm(`Disconnect Airtable for ${props.clientName}? You can reconnect any time.`)) return;
    setBusy("Disconnecting…");
    setError(null);
    const res = await fetch(
      `/api/admin/settings/airtable?clientId=${encodeURIComponent(props.clientId)}`,
      { method: "DELETE" },
    );
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
          Airtable access is scoped per-client. Use the Airtable OAuth flow to authorize access
          without ever pasting a token, or paste a Personal Access Token as an alternative.
        </p>

        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-muted-foreground">Status:</span>
          {props.hasOAuth ? (
            <Badge variant="success">OAuth connected</Badge>
          ) : props.hasToken ? (
            <Badge variant="success">PAT stored</Badge>
          ) : (
            <Badge variant="secondary">Not connected</Badge>
          )}
          {props.connectedAt ? (
            <span className="text-xs text-muted-foreground">
              connected {formatRelative(props.connectedAt)}
            </span>
          ) : props.verifiedAt ? (
            <span className="text-xs text-muted-foreground">
              verified {formatRelative(props.verifiedAt)}
            </span>
          ) : null}
        </div>

        {props.oauthEnabled ? (
          <div className="flex flex-wrap gap-2">
            <Button onClick={connectOAuth} disabled={!!busy} variant="accent">
              {connected ? "Reconnect Airtable" : "Connect Airtable"}
            </Button>
            {connected ? (
              <Button variant="ghost" onClick={disconnect} disabled={!!busy}>
                Disconnect
              </Button>
            ) : null}
            {!props.hasOAuth ? (
              <Button
                variant="outline"
                onClick={() => setShowPatEditor((v) => !v)}
                disabled={!!busy}
              >
                {showPatEditor ? "Hide PAT option" : props.hasToken ? "Replace PAT" : "Use a PAT instead"}
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-border bg-navy-50/40 p-3 text-xs text-muted-foreground">
            OAuth sign-in isn&apos;t configured on this deployment. Set{" "}
            <code>AIRTABLE_OAUTH_CLIENT_ID</code>, <code>AIRTABLE_OAUTH_CLIENT_SECRET</code>, and{" "}
            <code>AIRTABLE_OAUTH_REDIRECT_URI</code> in Vercel to enable the one-click flow. For now
            you can paste a Personal Access Token below.
          </div>
        )}

        {showPatEditor || !props.oauthEnabled ? (
          <div className="space-y-2 rounded-md border border-border bg-navy-50/30 p-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-navy-700">
              Personal Access Token
            </p>
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
              <Button onClick={savePAT} disabled={!token || !!busy}>
                {busy ?? "Save & verify"}
              </Button>
              {props.hasToken || props.hasOAuth ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setShowPatEditor(false);
                    setToken("");
                  }}
                >
                  Cancel
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}

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
