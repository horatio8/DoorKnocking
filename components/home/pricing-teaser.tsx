import Link from "next/link";
import { SectionHead } from "./section-head";
import { TrackedLink } from "@/components/marketing/tracked-link";

interface Plan {
  tier: "starter" | "pro" | "agency";
  name: string;
  numeral: string;
  pitch: string;
  price: string;
  unit?: string;
  features: string[];
  cta: { label: string; href: string; variant: "primary" | "oxblood" | "ghost"; event: "signup_cta_clicked" | "pricing_cta_clicked" };
  recommended?: boolean;
}

const PLANS: Plan[] = [
  {
    tier: "starter",
    name: "Starter",
    numeral: "I",
    pitch: "For the first-time candidate.",
    price: "$49",
    unit: "/month",
    features: [
      "1 district · 5 volunteer seats",
      "1,000 doors per cycle",
      "Basic AI — voter one-liners",
      "Offline canvassing & Airtable sync",
    ],
    cta: {
      label: "Start 14-day trial →",
      href: "/signup?plan=starter",
      variant: "primary",
      event: "pricing_cta_clicked",
    },
  },
  {
    tier: "pro",
    name: "Pro",
    numeral: "II",
    recommended: true,
    pitch: "For the consultant running multiple races.",
    price: "$199",
    unit: "/month",
    features: [
      "20 volunteer seats · 10,000 doors/cycle",
      "All AI · 1,000 min transcription",
      "Session debriefs · custom branding",
      "Priority email support",
    ],
    cta: {
      label: "Start 14-day trial →",
      href: "/signup?plan=pro",
      variant: "oxblood",
      event: "pricing_cta_clicked",
    },
  },
  {
    tier: "agency",
    name: "Agency",
    numeral: "III",
    pitch: "For parties, committees & firms.",
    price: "Custom",
    features: [
      "Unlimited districts & seats",
      "SSO/SAML · API access",
      "Dedicated success manager",
      "Custom SLAs & data residency",
    ],
    cta: {
      label: "Talk to sales",
      href: "/contact?intent=agency",
      variant: "ghost",
      event: "pricing_cta_clicked",
    },
  },
];

export function PricingTeaser() {
  return (
    <section
      id="pricing"
      className="border-y border-rule bg-parchment py-[84px]"
    >
      <div className="mx-auto max-w-[1200px] px-8">
        <SectionHead
          eyebrow="★   Pricing   ★"
          heading="Honest pricing. Cancel in one click."
          body="Fourteen days free. No credit card until the last day of your trial. All plans billed via Stripe."
        />
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {PLANS.map((p) => (
            <PlanCard key={p.tier} plan={p} />
          ))}
        </div>
        <p className="mt-2 text-center text-[13px] text-mute">
          <ShieldIcon className="-mb-0.5 mr-1 inline h-3 w-3 text-civic-navy" />
          Stripe-secured · PCI-DSS compliant · Data hosted in-region ·{" "}
          <Link href="/pricing" className="underline underline-offset-[3px] hover:text-oxblood">
            See full comparison →
          </Link>
        </p>
      </div>
    </section>
  );
}

function PlanCard({ plan }: { plan: Plan }) {
  const rec = plan.recommended;
  return (
    <div
      className={`relative flex min-h-[420px] flex-col border p-7 ${
        rec ? "border-civic-navy bg-civic-navy text-parchment" : "border-rule bg-white text-ink"
      }`}
    >
      {rec ? (
        <span className="absolute -top-3 left-6 bg-oxblood px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-parchment">
          ★ Most chosen
        </span>
      ) : null}
      <div className="mb-1 flex items-baseline justify-between">
        <h3
          className={`font-serif text-2xl font-semibold ${
            rec ? "text-parchment" : "text-civic-navy"
          }`}
        >
          {plan.name}
        </h3>
        <span
          className={`text-[11px] font-semibold tracking-[0.14em] ${
            rec ? "text-parchment/50" : "text-mute"
          }`}
        >
          {plan.numeral}
        </span>
      </div>
      <p
        className={`mb-[22px] font-serif text-sm italic ${
          rec ? "text-parchment/70" : "text-mute"
        }`}
      >
        {plan.pitch}
      </p>
      <div
        className={`mb-5 flex items-baseline gap-1.5 border-b pb-5 ${
          rec ? "border-parchment/15" : "border-rule-2"
        }`}
      >
        <span className="font-mono text-[40px] font-medium leading-none tracking-[-0.02em]">
          {plan.price}
        </span>
        {plan.unit ? (
          <span className={`text-[13px] ${rec ? "text-parchment/60" : "text-mute"}`}>
            {plan.unit}
          </span>
        ) : null}
      </div>
      <ul className="flex flex-1 list-none flex-col gap-[9px] p-0">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2.5 text-[13.5px] leading-[1.4]">
            <span
              className={`mt-[2px] flex-shrink-0 ${rec ? "text-parchment" : "text-oxblood"}`}
            >
              ✓
            </span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <TrackedLink
        href={plan.cta.href}
        event={plan.cta.event}
        eventProps={{ plan: plan.tier }}
        className={`mt-[22px] block rounded-sm border px-3 py-3 text-center text-sm font-semibold no-underline ${
          plan.cta.variant === "primary"
            ? "border-civic-navy bg-civic-navy text-parchment hover:bg-civic-navy-2"
            : plan.cta.variant === "oxblood"
              ? "border-oxblood bg-oxblood text-parchment hover:bg-oxblood-2"
              : "border-rule bg-transparent text-civic-navy hover:border-civic-navy hover:bg-parchment"
        }`}
      >
        {plan.cta.label}
      </TrackedLink>
    </div>
  );
}

function ShieldIcon(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.3} aria-hidden {...p}>
      <path d="M8 1.5l5.5 2v4.2c0 3.2-2.2 5.8-5.5 6.8-3.3-1-5.5-3.6-5.5-6.8V3.5z" />
      <path d="M5.5 8l2 2 3-3.5" />
    </svg>
  );
}
