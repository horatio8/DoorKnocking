"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Upload, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface DistrictOption {
  id: string;
  name: string;
}

interface Props {
  clientId: string | null;
  clientName: string | null;
  districts: DistrictOption[];
  defaultDistrictId: string | null;
}

type Panel = "none" | "invite" | "batch";

export function UsersActionsArea({ clientId, clientName, districts, defaultDistrictId }: Props) {
  const [panel, setPanel] = useState<Panel>("none");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-navy-900">Users</h1>
          <p className="text-sm text-muted-foreground">
            {clientName ? (
              <>
                Knockers and admins for <strong>{clientName}</strong>.
              </>
            ) : (
              "Knockers and admins across the platform."
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setPanel(panel === "batch" ? "none" : "batch")}
            disabled={!clientId}
          >
            <Upload className="mr-1.5 h-4 w-4" />
            Batch invite
          </Button>
          <Button
            variant="accent"
            onClick={() => setPanel(panel === "invite" ? "none" : "invite")}
            disabled={!clientId}
          >
            <UserPlus className="mr-1.5 h-4 w-4" />
            Invite user
          </Button>
        </div>
      </div>

      {panel === "invite" ? (
        <InvitePanel
          clientId={clientId}
          districts={districts}
          defaultDistrictId={defaultDistrictId}
          onClose={() => setPanel("none")}
        />
      ) : null}
      {panel === "batch" ? (
        <BatchPanel
          clientId={clientId}
          districts={districts}
          onClose={() => setPanel("none")}
        />
      ) : null}

      {!clientId ? (
        <p className="rounded-md border border-dashed border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          Pick a client in the header before inviting — users have to be scoped to a specific
          client.
        </p>
      ) : null}
    </div>
  );
}

function InvitePanel({
  clientId,
  districts,
  defaultDistrictId,
  onClose,
}: {
  clientId: string | null;
  districts: DistrictOption[];
  defaultDistrictId: string | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<"knocker" | "admin">("knocker");
  const [districtId, setDistrictId] = useState<string | null>(
    defaultDistrictId ?? districts[0]?.id ?? null,
  );
  const [paidCanvasser, setPaidCanvasser] = useState(false);
  const [passwordMode, setPasswordMode] = useState<"invite" | "now">("invite");
  const [initialPassword, setInitialPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    const res = await fetch("/api/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        fullName,
        role,
        clientId,
        districtId: role === "knocker" ? districtId : null,
        phone: phone || undefined,
        isPaidCanvasser: role === "knocker" ? paidCanvasser : false,
        initialPassword: passwordMode === "now" ? initialPassword : undefined,
      }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(body.error ?? `${res.status}`);
      return;
    }
    if (body.status === "linked") {
      setNotice(body.message ?? "Existing user linked to this client.");
    } else if (body.status === "created") {
      setNotice(`Account created for ${email}. Share the password securely.`);
    } else {
      setNotice(`Invite sent to ${email}.`);
    }
    setEmail("");
    setFullName("");
    setPhone("");
    setPaidCanvasser(false);
    setInitialPassword("");
    setPasswordMode("invite");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="rounded-lg border border-border bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-navy-900">Invite a user</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Existing emails are added to this client instead of re-invited.
          </p>
        </div>
        <button type="button" onClick={onClose} className="text-navy-400 hover:text-navy-700">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <label className="text-xs md:col-span-1">
          <span className="block font-semibold uppercase tracking-widest text-navy-500">
            Full name
          </span>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </label>
        <label className="text-xs md:col-span-2">
          <span className="block font-semibold uppercase tracking-widest text-navy-500">
            Email
          </span>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="email@example.com"
          />
        </label>
        <label className="text-xs md:col-span-1">
          <span className="block font-semibold uppercase tracking-widest text-navy-500">
            Role
          </span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "knocker" | "admin")}
            className="mt-1 h-10 w-full rounded-md border border-input bg-white px-2 text-sm"
          >
            <option value="knocker">Knocker</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        {role === "knocker" && districts.length > 0 ? (
          <label className="text-xs md:col-span-2">
            <span className="block font-semibold uppercase tracking-widest text-navy-500">
              Default district
            </span>
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
        ) : null}

        <label className="text-xs md:col-span-2">
          <span className="block font-semibold uppercase tracking-widest text-navy-500">
            Phone (optional)
          </span>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1…" />
        </label>

        {role === "knocker" ? (
          <label className="flex items-center gap-2 text-xs md:col-span-4">
            <input
              type="checkbox"
              checked={paidCanvasser}
              onChange={(e) => setPaidCanvasser(e.target.checked)}
            />
            <span>Paid canvasser (GPS required, can&apos;t decline tracking)</span>
          </label>
        ) : null}

        <fieldset className="text-xs md:col-span-4">
          <span className="block font-semibold uppercase tracking-widest text-navy-500">
            Password
          </span>
          <div className="mt-1 flex flex-wrap gap-3">
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                name="pwmode"
                checked={passwordMode === "invite"}
                onChange={() => setPasswordMode("invite")}
              />
              Send invite email
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                name="pwmode"
                checked={passwordMode === "now"}
                onChange={() => setPasswordMode("now")}
              />
              Set password now
            </label>
          </div>
          {passwordMode === "now" ? (
            <Input
              type="text"
              value={initialPassword}
              onChange={(e) => setInitialPassword(e.target.value)}
              placeholder="Min 8 characters"
              className="mt-2"
            />
          ) : null}
        </fieldset>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Button type="submit" disabled={busy || !clientId} variant="accent">
          {busy ? "Sending…" : "Send invite"}
        </Button>
        <Button type="button" variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>

      {error ? (
        <p className="mt-3 rounded bg-crimson/10 px-3 py-2 text-xs text-crimson">{error}</p>
      ) : null}
      {notice ? (
        <p className="mt-3 rounded bg-emerald-100 px-3 py-2 text-xs text-emerald-800">{notice}</p>
      ) : null}
    </form>
  );
}

function parseBlob(blob: string, districts: DistrictOption[]) {
  const lines = blob
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  return lines.map((line) => {
    const parts = line.split(",").map((p) => p.trim());
    const email = parts[0] ?? "";
    const fullName = parts[1] ?? "";
    const roleRaw = (parts[2] ?? "knocker").toLowerCase();
    const role: "knocker" | "admin" = roleRaw === "admin" ? "admin" : "knocker";
    const districtName = parts[3];
    const districtId = districtName
      ? districts.find((d) => d.name.toLowerCase() === districtName.toLowerCase())?.id ?? null
      : districts[0]?.id ?? null;
    return { email, fullName, role, districtId };
  });
}

function BatchPanel({
  clientId,
  districts,
  onClose,
}: {
  clientId: string | null;
  districts: DistrictOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [blob, setBlob] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    linked: number;
    invited: number;
    errors: number;
    results: Array<{ email: string; status: string; error?: string }>;
  } | null>(null);

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

  return (
    <div className="rounded-lg border border-border bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-navy-900">Batch invite users</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            One per line:{" "}
            <code className="rounded bg-navy-50 px-1">email,Full Name,role,district</code>. Role
            defaults to <code>knocker</code>. District defaults to the first of this client&apos;s
            districts. Existing users get added to this client instead of re-invited.
          </p>
        </div>
        <button type="button" onClick={onClose} className="text-navy-400 hover:text-navy-700">
          <X className="h-4 w-4" />
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
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>

      {error ? (
        <p className="mt-3 rounded bg-crimson/10 px-3 py-2 text-xs text-crimson">{error}</p>
      ) : null}

      {result ? (
        <div className="mt-3 space-y-1 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
          <p className="font-medium">
            {result.invited} invited, {result.linked} linked, {result.errors} errors.
          </p>
          <ul className="max-h-40 space-y-0.5 overflow-auto">
            {result.results.map((r) => (
              <li key={r.email}>
                <span className="font-mono">{r.email}</span>: {r.status}
                {r.error ? ` — ${r.error}` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
