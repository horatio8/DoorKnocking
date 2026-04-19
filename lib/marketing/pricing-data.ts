// Authoritative pricing data — mirrors design_handoff_onboarding_flow/pricing.jsx.
// Keep this in sync with the handoff; the admin surface can read it too when
// we wire Stripe.

export type Tier = "starter" | "pro" | "agency";

export interface Plan {
  tier: Tier;
  name: string;
  pitchLine: string;
  monthly: number | null;
  annual: number | null;
  custom?: boolean;
  recommended?: boolean;
  numeral: string;
  cta: string;
  features: Array<{ text: string; included: boolean }>;
}

export const PLANS: Plan[] = [
  {
    tier: "starter",
    name: "Starter",
    pitchLine: "For the first-time candidate.",
    monthly: 49,
    annual: 490,
    numeral: "I",
    cta: "Start 14-day trial",
    features: [
      { text: "1 district", included: true },
      { text: "5 volunteer seats", included: true },
      { text: "1,000 doors / cycle", included: true },
      { text: "Basic AI (voter one-liners)", included: true },
      { text: "Offline canvassing", included: true },
      { text: "Airtable sync", included: true },
      { text: "Voice transcription", included: false },
      { text: "Session debriefs", included: false },
      { text: "API access", included: false },
    ],
  },
  {
    tier: "pro",
    name: "Pro",
    pitchLine: "For the consultant running multiple races.",
    monthly: 199,
    annual: 1990,
    recommended: true,
    numeral: "II",
    cta: "Start 14-day trial",
    features: [
      { text: "1 district (+$99/mo extra)", included: true },
      { text: "20 volunteer seats", included: true },
      { text: "10,000 doors / cycle", included: true },
      { text: "All AI features", included: true },
      { text: "Voice transcription (1,000 min)", included: true },
      { text: "Session debriefs", included: true },
      { text: "Priority email support", included: true },
      { text: "Custom walkbook branding", included: true },
      { text: "API access", included: false },
    ],
  },
  {
    tier: "agency",
    name: "Agency",
    pitchLine: "For parties, committees, & firms.",
    monthly: null,
    annual: null,
    custom: true,
    numeral: "III",
    cta: "Talk to sales",
    features: [
      { text: "Unlimited districts", included: true },
      { text: "Unlimited volunteer seats", included: true },
      { text: "Unlimited doors", included: true },
      { text: "All AI + API access", included: true },
      { text: "SSO / SAML", included: true },
      { text: "Dedicated success manager", included: true },
      { text: "Annual contracts", included: true },
      { text: "Custom SLAs", included: true },
      { text: "Data residency options", included: true },
    ],
  },
];

type MatrixCell = boolean | string;

export interface MatrixGroup {
  group: string;
  rows: Array<[label: string, starter: MatrixCell, pro: MatrixCell, agency: MatrixCell]>;
}

export const FEATURE_MATRIX: MatrixGroup[] = [
  {
    group: "Core",
    rows: [
      ["Districts", "1", "1", "Unlimited"],
      ["Volunteer seats", "5", "20", "Unlimited"],
      ["Doors per cycle", "1,000", "10,000", "Unlimited"],
      ["Offline canvassing", true, true, true],
      ["Voter file import (CSV)", true, true, true],
      ["Airtable sync", true, true, true],
    ],
  },
  {
    group: "AI & automation",
    rows: [
      ["Voter one-liners", true, true, true],
      ["Voice transcription", false, "1,000 min/mo", "Unlimited"],
      ["Session debriefs", false, true, true],
      ["Custom AI prompts", false, false, true],
    ],
  },
  {
    group: "Collaboration",
    rows: [
      ["Walkbook generation", true, true, true],
      ["Custom branding", false, true, true],
      ["Turf assignment", true, true, true],
      ["Volunteer analytics", false, true, true],
    ],
  },
  {
    group: "Support & security",
    rows: [
      ["Email support", true, true, true],
      ["Priority support", false, true, true],
      ["Dedicated CSM", false, false, true],
      ["SSO / SAML", false, false, true],
      ["API access", false, false, true],
    ],
  },
];

export const TRUST_STATS: Array<{ n: string; l: string }> = [
  { n: "347", l: "campaigns run on Campaign OS" },
  { n: "1.2M", l: "doors knocked in 2024–26" },
  { n: "28", l: "states served" },
  { n: "99.9%", l: "uptime, verified" },
];
