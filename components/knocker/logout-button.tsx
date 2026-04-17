"use client";

import { Button } from "@/components/ui/button";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { clearSessionBundle } from "@/lib/offline/db";

export function LogoutButton() {
  const router = useRouter();
  async function onClick() {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    try {
      await clearSessionBundle();
    } catch {
      // Ignore — IndexedDB may not be open.
    }
    router.replace("/login");
    router.refresh();
  }
  return (
    <Button onClick={onClick} variant="outline" className="w-full">
      Sign out
    </Button>
  );
}
