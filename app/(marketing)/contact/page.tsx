import type { Metadata } from "next";
import Link from "next/link";
import { Eyebrow } from "@/components/marketing/eyebrow";
import { CivicButton } from "@/components/marketing/civic-button";

export const metadata: Metadata = {
  title: "Contact — Campaign OS",
  description: "Reach the Knock team — sales, support, security, or general questions.",
};

const INTENTS: Record<string, { eyebrow: string; heading: string; body: string }> = {
  agency: {
    eyebrow: "★ Agency plan ★",
    heading: "Let's talk about your firm.",
    body: "Tell us about the races you're running. We'll come back inside one business day with a tailored plan, SSO/SAML pilot, and pricing.",
  },
  default: {
    eyebrow: "Contact",
    heading: "Get in touch.",
    body: "Sales, support, security questions, or partnership ideas — same form, real human reads each one.",
  },
};

export default function ContactPage({
  searchParams,
}: {
  searchParams?: { intent?: string };
}) {
  const variant = INTENTS[searchParams?.intent ?? "default"] ?? INTENTS.default;

  return (
    <div className="border-t border-rule bg-paper px-8 py-20">
      <div className="mx-auto max-w-[640px]">
        <Eyebrow variant="oxblood" className="mb-3 block">
          {variant!.eyebrow}
        </Eyebrow>
        <h1 className="mb-3 font-serif text-[40px] font-semibold leading-[1.05] tracking-[-0.02em] text-civic-navy">
          {variant!.heading}
        </h1>
        <p className="mb-8 max-w-[520px] text-[16px] text-ink-2">{variant!.body}</p>

        <form
          method="post"
          action="mailto:hello@campaignos.com"
          className="grid gap-4 border border-rule bg-white p-6"
        >
          <Field label="Your name">
            <input
              name="name"
              required
              className="block w-full rounded-sm border border-rule bg-white px-3 py-[11px] text-[15px] outline-none focus:border-civic-navy focus:shadow-[0_0_0_3px_rgba(11,37,69,0.12)]"
            />
          </Field>
          <Field label="Work email">
            <input
              name="email"
              type="email"
              required
              className="block w-full rounded-sm border border-rule bg-white px-3 py-[11px] text-[15px] outline-none focus:border-civic-navy focus:shadow-[0_0_0_3px_rgba(11,37,69,0.12)]"
            />
          </Field>
          <Field label="Organization (optional)">
            <input
              name="organization"
              className="block w-full rounded-sm border border-rule bg-white px-3 py-[11px] text-[15px] outline-none focus:border-civic-navy focus:shadow-[0_0_0_3px_rgba(11,37,69,0.12)]"
            />
          </Field>
          <Field label="What can we help with?">
            <textarea
              name="message"
              rows={4}
              required
              className="block w-full rounded-sm border border-rule bg-white px-3 py-[11px] text-[15px] outline-none focus:border-civic-navy focus:shadow-[0_0_0_3px_rgba(11,37,69,0.12)]"
            />
          </Field>
          <input type="hidden" name="intent" value={searchParams?.intent ?? "default"} />
          <CivicButton type="submit" variant="primary" size="lg" className="w-full">
            Send →
          </CivicButton>
        </form>

        <p className="mt-6 text-center text-xs text-mute">
          Prefer a direct email?{" "}
          <a
            href="mailto:hello@campaignos.com"
            className="text-civic-navy underline underline-offset-[3px] hover:text-oxblood"
          >
            hello@campaignos.com
          </a>{" "}
          · or{" "}
          <Link
            href="/pricing"
            className="text-civic-navy underline underline-offset-[3px] hover:text-oxblood"
          >
            see pricing
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-sans text-[12px] font-semibold uppercase tracking-[0.06em] text-mute">
        {label}
      </span>
      {children}
    </label>
  );
}
