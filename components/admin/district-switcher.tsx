"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";

interface DistrictOption {
  id: string;
  name: string;
}

interface Props {
  activeDistrictId: string | null;
  districts: DistrictOption[];
}

// Mirrors ClientSwitcher. Empty value ("") means "All districts in
// scope" — the dropdown writes that as a cookie clear via DELETE-like
// POST, so pages downstream can render an everything-in-scope view.
export function DistrictSwitcher({ activeDistrictId, districts }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onChange(id: string) {
    setBusy(true);
    await fetch("/api/admin/active-district", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ districtId: id || null }),
    });
    router.refresh();
    setBusy(false);
  }

  if (districts.length === 0) {
    return <p className="text-xs text-muted-foreground">No districts available.</p>;
  }

  return (
    <label className="relative inline-flex cursor-pointer items-center gap-1 text-sm font-medium text-navy-900">
      <select
        disabled={busy}
        value={activeDistrictId ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none bg-transparent pr-5 focus:outline-none"
      >
        <option value="">All districts ({districts.length})</option>
        {districts.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>
      <ChevronDown className="h-4 w-4 text-navy-500" />
    </label>
  );
}
