import { redirect } from "next/navigation";
import Link from "next/link";
import { MapIcon, ClipboardListIcon, UserIcon } from "lucide-react";
import { loadSession } from "@/lib/auth/session";
import { SyncBadge } from "@/components/knocker/sync-badge";
import { getActiveClient } from "@/lib/clients/active";

export default async function KnockerLayout({ children }: { children: React.ReactNode }) {
  const [session, client] = await Promise.all([loadSession(), getActiveClient()]);
  if (!session) redirect("/login");
  const brandLabel = client?.brand?.short_name ?? client?.name ?? "Campaign OS";

  return (
    <div className="flex h-screen flex-col bg-background">
      <header
        className="flex items-center justify-between border-b border-border px-4 py-3 text-white"
        style={{ backgroundColor: "var(--client-primary)" }}
      >
        <div>
          <p className="text-[10px] uppercase tracking-widest text-white/70">{brandLabel}</p>
          <h1 className="text-sm font-semibold">
            {session.district?.name ?? "Door Knock"}
          </h1>
        </div>
        <SyncBadge />
      </header>
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
          My Day
        </Link>
      </nav>
    </div>
  );
}
