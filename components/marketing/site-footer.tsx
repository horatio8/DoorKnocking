import Link from "next/link";
import { CampaignOSMark } from "./campaign-os-mark";
import { Eyebrow } from "./eyebrow";

const COLUMNS: Array<{ heading: string; links: Array<{ label: string; href: string }> }> = [
  {
    heading: "Product",
    links: [
      { label: "Pricing", href: "/pricing" },
      { label: "Features", href: "#" },
      { label: "Security", href: "#" },
      { label: "Changelog", href: "#" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About", href: "#" },
      { label: "Customers", href: "#" },
      { label: "Contact", href: "#" },
      { label: "Careers", href: "#" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Terms", href: "#" },
      { label: "Privacy", href: "#" },
      { label: "DPA", href: "#" },
      { label: "Status", href: "#" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-rule bg-parchment px-8 py-10">
      <div className="mx-auto grid max-w-[1240px] gap-10 md:grid-cols-[1.2fr_1fr_1fr_1fr]">
        <div>
          <div className="mb-3 flex items-center gap-2.5 text-civic-navy">
            <CampaignOSMark size={24} />
            <span className="font-serif text-[17px] font-semibold">Campaign OS</span>
          </div>
          <p className="max-w-[280px] text-[13px] text-mute">
            Door-to-door canvassing software built for down-ballot campaigns who take their data
            seriously.
          </p>
        </div>
        {COLUMNS.map((col) => (
          <div key={col.heading}>
            <Eyebrow className="mb-3 block">{col.heading}</Eyebrow>
            <ul className="grid gap-2">
              {col.links.map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="text-[13px] text-ink-2 no-underline hover:text-oxblood">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mx-auto mt-8 flex max-w-[1240px] flex-wrap items-center justify-between gap-3 border-t border-rule pt-4 text-xs text-mute">
        <span>© 2026 Teller Consulting — Campaign OS</span>
        <span className="font-mono">v1.4.2 · US-East</span>
      </div>
    </footer>
  );
}
