"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function PromoteTagButton({ tagId }: { tagId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function onClick() {
    setBusy(true);
    const supabase = getSupabaseBrowserClient();
    const { data: auth } = await supabase.auth.getUser();
    await supabase
      .from("tags")
      .update({
        is_standard: true,
        promoted_by: auth.user?.id ?? null,
        promoted_at: new Date().toISOString(),
      })
      .eq("id", tagId);
    setBusy(false);
    router.refresh();
  }
  return (
    <Button onClick={onClick} disabled={busy} size="sm" variant="outline">
      {busy ? "…" : "Promote"}
    </Button>
  );
}
