import Link from "next/link";
import { CampaignOSMark } from "@/components/marketing/campaign-os-mark";

const COLS: Array<{ heading: string; links: Array<{ label: string; href: string }> }> = [
  {
    heading: "Product",
    links: [
      { label: "Pricing", href: "/pricing" },
      { label: "Features", href: "#features" },
      { label: "Security", href: "/security" },
      { label: "Changelog", href: "/changelog" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Customers", href: "/customers" },
      { label: "Contact", href: "/contact" },
      { label: "Careers", href: "/careers" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Terms", href: "/terms" },
      { label: "Privacy", href: "/privacy" },
      { label: "DPA", href: "/dpa" },
      { label: "Status", href: "/status" },
    ],
  },
];

export function HomeFooter() {
  return (
    <footer className="border-t border-rule bg-parchment px-0 py-12">
      <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-10 px-8 md:grid-cols-[1.3fr_1fr_1fr_1fr]">
        <div>
          <Link href="/" className="flex items-center gap-2.5 text-civic-navy no-underline">
            <CampaignOSMark size={28} />
            <span className="font-serif text-[19px] font-semibold text-civic-navy">Knock</span>
          </Link>
          <p className="mt-3 max-w-[280px] text-[13px] text-mute">
            Door-to-door canvassing software for down-ballot campaigns who take their data
            seriously.
          </p>
        </div>
        {COLS.map((col) => (
          <div key={col.heading}>
            <div className="mb-3 font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-mute">
              {col.heading}
            </div>
            <ul className="grid list-none gap-2 p-0">
              {col.links.map((l) => (
                <li key={l.label}>
                  <Link
                    href={l.href}
                    className="text-[13px] text-ink-2 no-underline hover:text-oxblood"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mx-auto mt-8 flex max-w-[1200px] flex-wrap justify-between gap-3 border-t border-rule px-8 pt-4 text-xs text-mute">
        <span>© 2026 Teller Consulting Group · ARN 93 676 364 855</span>
        <span className="font-mono">v1.0 · Paid for by Campaign OS</span>
      </div>
    </footer>
  );
}
