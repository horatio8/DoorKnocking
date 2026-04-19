import Link from "next/link";
import { CampaignOSMark } from "@/components/marketing/campaign-os-mark";
import { TrackedLink } from "@/components/marketing/tracked-link";

// Sticky navy top bar. The two right-side buttons keep their *existing*
// auth wiring — Sign in hits the already-built /login flow, Open field app
// hits /app (which itself redirects to /login when there's no session).

export function TopBar() {
  return (
    <header className="sticky top-0 z-50 border-b border-rule-dark bg-civic-navy text-parchment">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-6 px-8 py-3.5">
        <Link href="/" className="flex items-center gap-2.5 text-parchment no-underline">
          <CampaignOSMark size={28} />
          <span className="font-serif text-[19px] font-semibold tracking-[-0.01em]">Knock</span>
          <span className="ml-1.5 border-l border-parchment/20 pl-2.5 font-sans text-[10px] uppercase tracking-[0.18em] text-parchment/55">
            Campaign OS
          </span>
        </Link>
        <nav aria-label="Primary" className="hidden gap-7 md:flex">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-[13.5px] text-parchment/80 no-underline hover:text-parchment"
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <TrackedLink
            href="/login"
            event="signin_clicked"
            data-action="sign-in"
            className="inline-flex items-center justify-center gap-2 rounded-sm border border-oxblood bg-oxblood px-3.5 py-2 text-[13px] font-semibold text-parchment no-underline transition-colors hover:bg-oxblood-2"
          >
            Sign in
          </TrackedLink>
          <TrackedLink
            href="/app"
            event="signin_clicked"
            eventProps={{ target: "field_app" }}
            data-action="open-field-app"
            className="inline-flex items-center justify-center gap-2 rounded-sm border border-parchment/35 bg-transparent px-3.5 py-2 text-[13px] font-semibold text-parchment no-underline transition-colors hover:border-parchment hover:bg-parchment/[0.08]"
          >
            Open field app →
          </TrackedLink>
        </div>
      </div>
    </header>
  );
}

const NAV: Array<{ label: string; href: string }> = [
  { label: "How it works", href: "#how" },
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
  { label: "Docs", href: "/docs" },
];
