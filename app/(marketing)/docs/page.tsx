import type { Metadata } from "next";
import Link from "next/link";
import { Eyebrow } from "@/components/marketing/eyebrow";
import { CivicButton } from "@/components/marketing/civic-button";

export const metadata: Metadata = {
  title: "Docs — Campaign OS",
  description: "Knock product documentation, API reference, and integration guides.",
};

const SECTIONS: Array<{
  title: string;
  description: string;
  links: Array<{ label: string; href: string }>;
}> = [
  {
    title: "Getting started",
    description: "Sign up, set up your first district, and import a voter file.",
    links: [
      { label: "Self-serve onboarding walkthrough", href: "/signup" },
      { label: "Pricing & trial details", href: "/pricing" },
      { label: "Connect your Airtable base", href: "#airtable" },
    ],
  },
  {
    title: "Field operations",
    description: "Walkbooks, turf, knock sessions, voice notes.",
    links: [
      { label: "Walkbook generation", href: "#walkbooks" },
      { label: "Turf cutting & assignment", href: "#turf" },
      { label: "Knocker app & offline canvassing", href: "#field-app" },
    ],
  },
  {
    title: "Reporting & data",
    description: "Surveys, exports, AI debriefs, and the Airtable mirror.",
    links: [
      { label: "Survey authoring & response export", href: "#surveys" },
      { label: "Nightly debrief emails", href: "#debriefs" },
      { label: "API access (Pro & Agency)", href: "#api" },
    ],
  },
  {
    title: "Trust & security",
    description: "SOC 2, data residency, RLS, retention.",
    links: [
      { label: "Security overview", href: "/security" },
      { label: "Data processing agreement", href: "/dpa" },
      { label: "Status page", href: "/status" },
    ],
  },
];

export default function DocsPage() {
  return (
    <div className="border-t border-rule bg-paper px-8 py-20">
      <div className="mx-auto max-w-[960px]">
        <Eyebrow variant="oxblood" className="mb-3 block">
          Documentation
        </Eyebrow>
        <h1 className="mb-4 font-serif text-[44px] font-semibold leading-[1.05] tracking-[-0.02em] text-civic-navy">
          The Knock manual.
        </h1>
        <p className="mb-12 max-w-[640px] text-[16px] text-ink-2">
          Long-form docs are still being assembled — most short answers are in the{" "}
          <Link href="/#faq" className="text-civic-navy underline underline-offset-[3px] hover:text-oxblood">
            FAQ
          </Link>
          . Below is the structure we&rsquo;re writing into. If you need an answer that&rsquo;s
          missing,{" "}
          <Link href="/contact" className="text-civic-navy underline underline-offset-[3px] hover:text-oxblood">
            reach out
          </Link>{" "}
          and we&rsquo;ll prioritise it.
        </p>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {SECTIONS.map((s) => (
            <section key={s.title} className="border border-rule bg-white p-6">
              <h2 className="mb-2 font-serif text-[22px] font-semibold leading-[1.25] text-civic-navy">
                {s.title}
              </h2>
              <p className="mb-4 text-[14px] text-ink-2">{s.description}</p>
              <ul className="grid gap-2">
                {s.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className="text-[14px] text-civic-navy underline underline-offset-[3px] hover:text-oxblood"
                    >
                      → {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div className="mt-12 border border-rule bg-parchment p-6 text-center">
          <Eyebrow variant="oxblood" className="mb-2 block">
            Can&rsquo;t find it?
          </Eyebrow>
          <p className="mb-4 text-[15px] text-ink-2">
            We answer real-person within a business day.
          </p>
          <CivicButton as="link" href="/contact" variant="primary">
            Contact support →
          </CivicButton>
        </div>
      </div>
    </div>
  );
}
