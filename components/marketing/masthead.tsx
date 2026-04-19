import Link from "next/link";
import { CampaignOSMark } from "./campaign-os-mark";
import { CivicButton } from "./civic-button";

// Marketing-surface top nav. Matches <Masthead /> in the handoff.

export function Masthead() {
  return (
    <header className="border-b border-rule bg-paper">
      <div className="mx-auto flex max-w-[1240px] items-center justify-between px-8 py-3.5">
        <Link href="/pricing" className="flex items-center gap-2.5 text-civic-navy no-underline">
          <CampaignOSMark size={28} />
          <span className="font-serif text-[20px] font-semibold leading-none tracking-[-0.01em]">
            Campaign OS
          </span>
        </Link>
        <nav className="hidden items-center gap-7 text-sm md:flex">
          <Link href="/pricing" className="text-civic-navy underline-offset-[3px] hover:text-oxblood">
            Pricing
          </Link>
          <Link href="#features" className="text-civic-navy underline-offset-[3px] hover:text-oxblood">
            Features
          </Link>
          <Link href="#customers" className="text-civic-navy underline-offset-[3px] hover:text-oxblood">
            Customers
          </Link>
          <Link href="#docs" className="text-civic-navy underline-offset-[3px] hover:text-oxblood">
            Docs
          </Link>
        </nav>
        <div className="flex items-center gap-2.5">
          <CivicButton as="link" href="/login" variant="ghost" size="sm">
            Log in
          </CivicButton>
          <CivicButton as="link" href="/signup" variant="primary" size="sm">
            Start free trial
          </CivicButton>
        </div>
      </div>
    </header>
  );
}
