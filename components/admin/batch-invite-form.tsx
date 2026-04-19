"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface Row {
  email: string;
  fullName: string;
  role: "knocker" | "admin";
  districtId: string | null;
}

interface Props {
  clientId: string | null;
  districts: Array<{ id: string; name: string }>;
}

// Accepts a simple text blob: one invitee per line. Columns separated by
// commas. Supported formats:
//   email
//   email,Full Name
//   email,Full Name,role
//   email,Full Name,role,district-slug
// role defaults to 'knocker'; district defaults to the first client district.
function parseBlob(blob: string, districts: Array<{ id: string; name: string }>): Row[] {
  const lines = blob
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  return lines.map((line) => {
    const parts = line.split(",").map((p) => p.trim());
    const email = parts[0] ?? "";
    const fullName = parts[1] ?? "";
    const roleRaw = (parts[2] ?? "knocker").toLowerCase();
    const role: Row["role"] = roleRaw === "admin" ? "admin" : "knocker";
    const districtSlug = parts[3];
    const districtId = districtSlug
      ? districts.find((d) => d.name.toLowerCase() === districtSlug.toLowerCase())?.id ?? null
      : districts[0]?.id ?? null;
    return { email, fullName, role, districtId };
  });
}

export function BatchInviteForm({ clientId, districts }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [blob, setBlob] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    linked: number;
    invited: number;
    errors: number;
    results: Array<{ email: string; status: string; error?: string }>;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const rows = parseBlob(blob, districts);
    if (rows.length === 0) {
      setError("Paste at least one row (email per line).");
      return;
    }
    const invalid = rows.find((r) => !r.email.includes("@"));
    if (invalid) {
      setError(`Invalid email: "${invalid.email}"`);
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    const res = await fetch("/api/admin/users/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId,
        invites: rows.map((r) => ({
          email: r.email,
          fullName: r.fullName || undefined,
          role: r.role,
          districtId: r.districtId ?? undefined,
        })),
      }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(body.error ?? `${res.status}`);
      return;
    }
    setResult(body);
    router.refresh();
  }

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)} disabled={!clientId}>
        Batch invite…
      </Button>
    );
  }

  return (
    <div className="w-full rounded-md border border-navy-100 bg-white p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-navy-900">Batch invite users</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            One per line: <code>email,Full Name,role,district</code>. role defaults to{" "}
            <code>knocker</code>, district defaults to the first of this client&apos;s districts.
            Existing users get added to this client instead of re-invited.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-navy-500 underline"
        >
          Close
        </button>
      </div>

      <textarea
        value={blob}
        onChange={(e) => setBlob(e.target.value)}
        placeholder={`alice@example.com,Alice Chen,knocker,${districts[0]?.name ?? ""}\nbob@example.com,Bob Johnson,admin\ncarol@example.com`}
        rows={6}
        className="mt-3 w-full rounded-md border border-navy-200 p-2 font-mono text-xs"
      />

      <div className="mt-3 flex items-center gap-2">
        <Button onClick={submit} disabled={busy || !clientId} variant="accent">
          {busy ? "Sending…" : "Send batch"}
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        {!clientId ? (
          <span className="text-xs text-amber-700">Select a client in the header first.</span>
        ) : null}
      </div>

      {error ? (
        <p className="mt-3 rounded bg-crimson/10 px-3 py-2 text-xs text-crimson">{error}</p>
      ) : null}

      {result ? (
        <div className="mt-3 space-y-1 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
          <p className="font-medium">
            {result.invited} invited, {result.linked} linked, {result.errors} errors.
          </p>
          {result.results.map((r) => (
            <p key={r.email}>
              <span className="font-mono">{r.email}</span>: {r.status}
              {r.error ? ` — ${r.error}` : ""}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
