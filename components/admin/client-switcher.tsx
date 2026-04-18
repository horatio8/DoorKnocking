"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";

interface ClientOption {
  id: string;
  name: string;
  slug: string;
}

interface Props {
  activeClientId: string | null;
  clients: ClientOption[];
}

export function ClientSwitcher({ activeClientId, clients }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const active = clients.find((c) => c.id === activeClientId) ?? clients[0];

  async function onChange(id: string) {
    setBusy(true);
    await fetch("/api/admin/active-client", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: id }),
    });
    router.refresh();
    setBusy(false);
  }

  if (clients.length === 0) {
    return <p className="text-sm text-muted-foreground">No clients available.</p>;
  }

  return (
    <label className="relative inline-flex cursor-pointer items-center gap-1 text-lg font-semibold text-navy-900">
      <select
        disabled={busy || clients.length === 1}
        value={active?.id ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none bg-transparent pr-5 focus:outline-none"
      >
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name} — {c.slug}
          </option>
        ))}
      </select>
      <ChevronDown className="h-4 w-4 text-navy-500" />
    </label>
  );
}
