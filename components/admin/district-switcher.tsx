"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { District } from "@/lib/types";
import { ChevronDown } from "lucide-react";

interface Props {
  activeDistrictId: string | null;
  districts: District[];
}

export function DistrictSwitcher({ activeDistrictId, districts }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const active = districts.find((d) => d.id === activeDistrictId) ?? districts[0];

  async function onChange(id: string) {
    setBusy(true);
    const supabase = getSupabaseBrowserClient();
    const { data: userRes } = await supabase.auth.getUser();
    if (userRes.user) {
      await supabase
        .from("users")
        .update({ default_district_id: id })
        .eq("id", userRes.user.id);
    }
    router.refresh();
    setBusy(false);
  }

  if (districts.length === 0) {
    return <p className="text-sm text-muted-foreground">No districts provisioned.</p>;
  }

  return (
    <label className="relative inline-flex cursor-pointer items-center gap-1 text-lg font-semibold text-navy-900">
      <select
        disabled={busy}
        value={active?.id ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none bg-transparent pr-5 focus:outline-none"
      >
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
