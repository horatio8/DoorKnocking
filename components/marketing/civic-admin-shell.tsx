import Link from "next/link";
import { CampaignOSMark } from "./campaign-os-mark";
import { cn } from "@/lib/utils";
import type { SVGProps } from "react";

// Civic-palette admin shell from design_handoff_onboarding_flow/dashboard.jsx.
// Deliberately separate from the production app/(admin) shell — this is the
// onboarding-handoff aesthetic. When we decide to promote it to the real
// admin, swap the import in app/(admin)/admin/layout.tsx.

const NAV: Array<{ label: string; href: string; icon: (p: SVGProps<SVGSVGElement>) => JSX.Element }> = [
  { label: "Overview", href: "#", icon: ChartIcon },
  { label: "Voters", href: "#", icon: UserIcon },
  { label: "Walkbooks", href: "#", icon: DocIcon },
  { label: "Turf", href: "#", icon: MapIcon },
  { label: "Volunteers", href: "#", icon: UserIcon },
  { label: "Reports", href: "#", icon: ChartIcon },
  { label: "Settings", href: "#", icon: GearIcon },
  { label: "Billing", href: "#", icon: CardIcon },
];

export function CivicAdminShell({
  active = "Voters",
  campaign = "Sprouse for SC 115",
  planBadge = "TRIAL · 13 DAYS LEFT",
  banner,
  children,
}: {
  active?: string;
  campaign?: string;
  planBadge?: string;
  banner?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen grid-cols-[220px_1fr] bg-paper">
      <aside className="flex flex-col bg-civic-navy py-5 text-parchment">
        <div className="mb-4 border-b border-parchment/10 px-5 pb-5">
          <Link href="/pricing" className="flex items-center gap-2 text-parchment no-underline">
            <CampaignOSMark size={20} />
            <span className="font-serif text-[15px] font-semibold">Campaign OS</span>
          </Link>
          <div className="mt-3 rounded-[2px] border border-parchment/20 px-2.5 py-2">
            <div className="text-[10px] uppercase tracking-[0.1em] text-parchment/50">
              Campaign
            </div>
            <div className="mt-0.5 text-[13px] font-semibold">{campaign}</div>
          </div>
        </div>
        <nav className="grid gap-0.5 px-2.5">
          {NAV.map((item) => {
            const activeNav = active === item.label;
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-[2px] px-3 py-2 text-[13px] no-underline text-parchment",
                  activeNav ? "bg-parchment/10 font-semibold" : "font-normal hover:bg-parchment/5",
                )}
              >
                <Icon
                  className={cn("h-4 w-4", activeNav ? "text-oxblood" : "text-parchment/60")}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto border-t border-parchment/10 px-4 py-3.5 text-[11px]">
          <div className="mb-1 text-[9px] uppercase tracking-[0.12em] text-parchment/50">
            Plan
          </div>
          <div className="font-mono text-[11px] font-semibold text-oxblood">{planBadge}</div>
        </div>
      </aside>
      <main className="min-w-0">
        {banner}
        <div className="px-8 py-6">{children}</div>
      </main>
    </div>
  );
}

// Monoline sidebar icons — inline to keep this shell self-contained.
function ChartIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.3} aria-hidden {...p}>
      <path d="M2 14h12M4 14V8M7 14V4M10 14V10M13 14V6" />
    </svg>
  );
}
function UserIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.3} aria-hidden {...p}>
      <circle cx="8" cy="5.5" r="2.5" />
      <path d="M2.5 14c.5-3 2.8-4.5 5.5-4.5s5 1.5 5.5 4.5" />
    </svg>
  );
}
function DocIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.3} aria-hidden {...p}>
      <path d="M3.5 1.5h6L12.5 4.5v10h-9z" />
      <path d="M9.5 1.5v3h3M5.5 7.5h5M5.5 10h5M5.5 12.5h3" />
    </svg>
  );
}
function MapIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.3} aria-hidden {...p}>
      <path d="M1 3.5l5-1.5 4 1.5 5-1.5v11l-5 1.5-4-1.5-5 1.5z" />
      <path d="M6 2v12M10 3.5v12" />
    </svg>
  );
}
function GearIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.3} aria-hidden {...p}>
      <circle cx="8" cy="8" r="2" />
      <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.3 3.3l1.4 1.4M11.3 11.3l1.4 1.4M3.3 12.7l1.4-1.4M11.3 4.7l1.4-1.4" />
    </svg>
  );
}
function CardIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.3} aria-hidden {...p}>
      <rect x="1.5" y="3.5" width="13" height="9" rx="0.5" />
      <path d="M1.5 6.5h13M4 10h3" />
    </svg>
  );
}
