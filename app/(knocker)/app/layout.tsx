import { redirect } from "next/navigation";
import Link from "next/link";
import { MapIcon, ClipboardListIcon, UserIcon } from "lucide-react";
import { loadSession } from "@/lib/auth/session";
import { SyncBadge } from "@/components/knocker/sync-badge";
import { FullscreenToggle } from "@/components/knocker/fullscreen-toggle";
import { FieldStoreHydrator } from "@/components/knocker/field-store-hydrator";
import { getActiveClient } from "@/lib/clients/active";

export default async function KnockerLayout({ children }: { children: React.ReactNode }) {
  const [session, client] = await Promise.all([loadSession(), getActiveClient()]);
  if (!session) redirect("/login");
  const brandLabel = client?.brand?.short_name ?? client?.name ?? "Campaign OS";
  const districtId = session.district?.id ?? session.user.default_district_id ?? null;

  return (
    <div
      data-knocker-shell
      className="fixed inset-0 flex flex-col overflow-hidden bg-background overscroll-contain"
      style={{
        height: "100dvh",
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <header
        className="flex items-center justify-between border-b border-border px-4 py-3 text-white"
        style={{ backgroundColor: "var(--client-primary)" }}
      >
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-white/70">{brandLabel}</p>
          <h1 className="truncate text-sm font-semibold">
            {session.district?.name ?? "Door Knock"}
          </h1>
        </div>
        <div className="flex items-center">
          <SyncBadge />
          <FullscreenToggle />
        </div>
      </header>
      <FieldStoreHydrator userId={session.user.id} districtId={districtId} />
      <main className="flex-1 overflow-hidden">{children}</main>
      <nav className="grid grid-cols-3 border-t border-border bg-white">
        <Link href="/app/map" className="flex flex-col items-center gap-1 py-2 text-xs text-navy-700 hover:text-navy">
          <MapIcon className="h-5 w-5" />
          Map
        </Link>
        <Link href="/app/walkbooks" className="flex flex-col items-center gap-1 py-2 text-xs text-navy-700 hover:text-navy">
          <ClipboardListIcon className="h-5 w-5" />
          Walkbooks
        </Link>
        <Link href="/app/me" className="flex flex-col items-center gap-1 py-2 text-xs text-navy-700 hover:text-navy">
          <UserIcon className="h-5 w-5" />
          Your profile
        </Link>
      </nav>
    </div>
  );
}
