import Link from "next/link";
import { TrackedLink } from "@/components/marketing/tracked-link";

const MICROLIST = [
  "No credit card",
  "Cancel in 1 click",
  "SOC 2 Type II",
  "30-day money-back (annual)",
];

export function FinalCTA() {
  return (
    <section className="border-t border-rule bg-paper py-24 text-center">
      <div className="mx-auto max-w-[1200px] px-8">
        <div className="mb-3.5 font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-oxblood">
          ★ ★ ★
        </div>
        <h2 className="mb-4 font-serif text-[46px] font-semibold leading-[1.08] tracking-[-0.01em] text-civic-navy">
          Fourteen days. One district. Your move.
        </h2>
        <p className="mx-auto mb-7 max-w-[540px] text-[17px] text-ink-2">
          You&rsquo;ll have a working walkbook for your race before the page you&rsquo;d spend
          looking at a &ldquo;book a demo&rdquo; calendar finishes loading.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <TrackedLink
            href="/signup"
            event="signup_cta_clicked"
            eventProps={{ location: "final_cta" }}
            className="inline-flex items-center justify-center gap-2 rounded-sm border border-oxblood bg-oxblood px-7 py-[15px] text-[15px] font-semibold text-parchment no-underline transition-colors hover:bg-oxblood-2"
          >
            Start free trial →
          </TrackedLink>
          <Link
            href="/pricing"
            className="inline-flex items-center justify-center gap-2 rounded-sm border border-rule bg-transparent px-7 py-[15px] text-[15px] font-semibold text-civic-navy no-underline transition-colors hover:border-civic-navy hover:bg-parchment"
          >
            See full pricing
          </Link>
        </div>
        <ul className="mt-7 flex flex-wrap justify-center gap-7 text-xs text-mute">
          {MICROLIST.map((m) => (
            <li key={m} className="inline-flex items-center gap-1.5">
              <Check /> {m}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Check() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.3} aria-hidden>
      <path d="M3 8.5L6.5 12 13 4.5" />
    </svg>
  );
}
