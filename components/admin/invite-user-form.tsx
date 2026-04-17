"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function InviteUserForm({ defaultDistrictId }: { defaultDistrictId: string | null }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"knocker" | "admin">("knocker");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function invite() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, fullName, role, districtId: defaultDistrictId }),
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
    return <Button onClick={() => setOpen(true)} variant="accent">Invite user</Button>;
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
      <Button type="submit" disabled={busy}>
        {busy ? "Sending…" : "Send invite"}
      </Button>
      <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
        Cancel
      </Button>
      {error ? <span className="w-full text-xs text-crimson">{error}</span> : null}
    </form>
  );
}
