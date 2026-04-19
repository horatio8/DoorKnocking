"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CampaignOSMark } from "./campaign-os-mark";
import { CivicButton } from "./civic-button";
import { CivicField, CivicInput, CivicLabel } from "./civic-input";
import { CivicCheckbox } from "./civic-check";
import { Eyebrow } from "./eyebrow";
import { ArrowIcon, ShieldIcon } from "./civic-icons";

// 02 · Signup — see design_handoff_onboarding_flow/signup.jsx SignupPage.
// 50/50 columns on desktop; stacked on mobile. Left is the form, right is
// the navy broadside with star row + pull-quote + "what you'll get" list.

const GUARANTEES = [
  "Unlimited knock events across your full trial",
  "Import up to 100 voters without a card",
  "Cloned walkbooks with custom branding",
  "Real-time sync with your Airtable base",
];

export function SignupView({ planName }: { planName: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tos, setTos] = useState(false);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!tos) return;
    // TODO: call Supabase auth.signUp. For now, forward to /verify with the
    // email so the parking screen can render it.
    const params = new URLSearchParams({ email });
    router.push(`/verify?${params.toString()}`);
  }

  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-2">
      {/* ── Left: form ── */}
      <div className="flex flex-col justify-center bg-paper px-14 py-16">
        <div className="mx-auto w-full max-w-[420px]">
          <Link href="/pricing" className="mb-9 inline-flex items-center gap-2 text-civic-navy no-underline">
            <CampaignOSMark size={22} />
            <span className="font-serif text-base font-semibold">Campaign OS</span>
          </Link>

          <Eyebrow variant="oxblood" className="mb-2.5 block">
            Begin — Step 1 of 4
          </Eyebrow>
          <h1 className="mb-2.5 font-serif text-[34px] font-semibold leading-[1.1] tracking-[-0.01em] text-civic-navy">
            Start your {planName} plan.
          </h1>
          <p className="mb-7 text-[15px] text-ink-2">
            14-day free trial — no card needed until day 14. Cancel in one click.
          </p>

          <form onSubmit={onSubmit} noValidate>
            <CivicField>
              <CivicLabel htmlFor="email">Email address</CivicLabel>
              <CivicInput
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@campaign.com"
                required
              />
            </CivicField>
            <CivicField>
              <CivicLabel htmlFor="pw">Password</CivicLabel>
              <CivicInput
                id="pw"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="8+ characters"
                minLength={8}
                required
              />
              <p className="mt-1.5 text-[11px] text-mute">
                Must contain a letter, number, and special character.
              </p>
            </CivicField>

            <CivicCheckbox
              id="tos"
              checked={tos}
              onCheckedChange={setTos}
              className="mb-5 mt-2"
            >
              I agree to the{" "}
              <Link href="/legal/terms" className="text-civic-navy underline-offset-[3px] hover:text-oxblood">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href="/legal/privacy" className="text-civic-navy underline-offset-[3px] hover:text-oxblood">
                Privacy Policy
              </Link>
              .
            </CivicCheckbox>

            <CivicButton
              type="submit"
              variant="primary"
              size="lg"
              disabled={!tos || !email || password.length < 8}
              className="w-full"
            >
              Create my account <ArrowIcon className="h-4 w-4" />
            </CivicButton>

            <p className="mt-5 text-center text-sm text-mute">
              Already have an account?{" "}
              <Link href="/login" className="text-civic-navy underline-offset-[3px] hover:text-oxblood">
                Log in
              </Link>
            </p>
          </form>

          <div className="mt-9 flex flex-wrap items-center gap-4 border-t border-rule-2 pt-5 text-[11px] text-mute">
            <span className="inline-flex items-center gap-1.5">
              <ShieldIcon className="h-3.5 w-3.5 text-civic-navy" /> SOC 2 Type II
            </span>
            <span className="inline-flex items-center gap-1.5">
              <LockIcon className="h-3.5 w-3.5 text-civic-navy" /> Encrypted at rest
            </span>
            <span className="inline-flex items-center gap-1.5">
              <FlagIcon className="h-3.5 w-3.5 text-civic-navy" /> US-hosted
            </span>
          </div>
        </div>
      </div>

      {/* ── Right: navy broadside ── */}
      <div className="relative bg-civic-navy px-14 py-16 text-parchment">
        <div className="absolute right-6 top-6 font-sans text-[10px] tracking-[0.2em] text-parchment/40">
          VOL. I · NO. 47
        </div>
        <div className="mx-auto max-w-[440px]">
          <div className="mb-6 text-sm tracking-[0.4em] text-oxblood">★ ★ ★ ★ ★</div>
          <blockquote className="mb-7 font-serif text-[28px] leading-[1.25] tracking-[-0.01em]">
            &ldquo;We knocked <span className="text-oxblood">11,400 doors</span> in six weeks with
            eleven volunteers. Nothing we&rsquo;d used before came close.&rdquo;
          </blockquote>
          <div className="flex items-center gap-3 border-t border-parchment/20 pt-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-parchment font-serif text-base font-semibold text-civic-navy">
              MH
            </div>
            <div>
              <div className="text-sm font-semibold">Marcus Hallman</div>
              <div className="text-xs text-parchment/60">
                Campaign Manager · Pritchett for SC Senate
              </div>
            </div>
          </div>

          <div className="mt-16 border-t border-parchment/15 pt-6">
            <Eyebrow variant="on-navy" className="mb-3.5 block">
              What you&rsquo;ll get
            </Eyebrow>
            <ul className="grid gap-3 text-sm">
              {GUARANTEES.map((g) => (
                <li key={g} className="flex items-start gap-2.5 text-parchment/90">
                  <CheckIcon className="mt-0.5 h-4 w-4 flex-none text-oxblood" />
                  <span>{g}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

// Two small icons inlined here (lock + flag) — the main icon set covers only
// what the pricing page needs. Using SVGs directly keeps the bundle tight.
function LockIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.3} aria-hidden {...props}>
      <rect x="3" y="7" width="10" height="7" rx="0.5" />
      <path d="M5 7V5a3 3 0 016 0v2" />
    </svg>
  );
}
function FlagIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.3} aria-hidden {...props}>
      <path d="M3 14V2M3 3h9l-2 3 2 3H3" />
    </svg>
  );
}
function CheckIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden {...props}>
      <path d="M3 8.5L6.5 12 13 4.5" />
    </svg>
  );
}
