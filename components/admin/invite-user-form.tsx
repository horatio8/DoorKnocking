"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface DistrictOption {
  id: string;
  name: string;
}

export function InviteUserForm({
  clientId,
  districts,
  defaultDistrictId,
}: {
  clientId: string | null;
  districts: DistrictOption[];
  defaultDistrictId: string | null;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"knocker" | "admin">("knocker");
  const [districtId, setDistrictId] = useState<string | null>(
    defaultDistrictId ?? districts[0]?.id ?? null,
  );
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function invite() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        fullName,
        role,
        clientId,
        districtId: role === "knocker" ? districtId : null,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Invite failed");
      return;
    }
    setOpen(false);
    setEmail("");
    setFullName("");
    router.refresh();
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} variant="accent" disabled={!clientId}>
        Invite user
      </Button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        invite();
      }}
      className="flex flex-wrap items-center gap-2 rounded-md border border-navy-100 bg-white p-3"
    >
      <Input
        placeholder="Full name"
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        className="w-40"
      />
      <Input
        type="email"
        placeholder="email@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        className="w-56"
      />
      <select
        value={role}
        onChange={(e) => setRole(e.target.value as "knocker" | "admin")}
        className="h-10 rounded-md border border-input px-2 text-sm"
      >
        <option value="knocker">Knocker</option>
        <option value="admin">Admin</option>
      </select>
      {role === "knocker" && districts.length > 0 ? (
        <select
          value={districtId ?? ""}
          onChange={(e) => setDistrictId(e.target.value || null)}
          className="h-10 rounded-md border border-input px-2 text-sm"
        >
          {districts.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      ) : null}
      <Button type="submit" disabled={busy || !clientId}>
        {busy ? "Sending…" : "Send invite"}
      </Button>
      <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
        Cancel
      </Button>
      {!clientId ? (
        <span className="w-full text-xs text-amber-700">
          Pick a client in the header dropdown before inviting — the user needs to be scoped to a
          specific client.
        </span>
      ) : null}
      {error ? <span className="w-full text-xs text-crimson">{error}</span> : null}
    </form>
  );
}
