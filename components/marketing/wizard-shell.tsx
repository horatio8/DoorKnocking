"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CampaignOSMark } from "./campaign-os-mark";
import { CivicButton } from "./civic-button";
import { Eyebrow } from "./eyebrow";
import { ArrowIcon } from "./civic-icons";

// Shared chrome for the 3-step onboarding wizard (04–06). Matches
// design_handoff_onboarding_flow/wizard.jsx WizardShell.

export function WizardShell({
  step,
  total = 3,
  title,
  continueLabel = "Continue",
  backHref,
  onContinue,
  continueDisabled,
  children,
}: {
  step: 1 | 2 | 3;
  total?: number;
  title: string;
  continueLabel?: string;
  backHref?: string;
  onContinue: () => void;
  continueDisabled?: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const percent = Math.round((step / total) * 100);

  return (
    <div className="min-h-screen bg-parchment px-4 py-8 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-[680px]">
        {/* Top bar */}
        <div className="mb-8 flex items-center justify-between">
          <Link href="/pricing" className="flex items-center gap-2.5 text-civic-navy no-underline">
            <CampaignOSMark size={22} />
            <span className="font-serif text-base font-semibold">Campaign OS</span>
          </Link>
          <div className="text-xs text-mute">
            Logged in as <strong className="text-civic-navy">you@campaign.com</strong> ·{" "}
            <Link href="/logout" className="text-civic-navy underline-offset-[3px] hover:text-oxblood">
              Sign out
            </Link>
          </div>
        </div>

        {/* Progress rib */}
        <div className="mb-9">
          <div className="mb-2.5 flex items-center justify-between">
            <Eyebrow variant="oxblood">Setup · Step {step} of {total}</Eyebrow>
            <span className="font-mono text-[11px] tracking-[0.12em] text-mute tabular-nums">
              {percent}% COMPLETE
            </span>
          </div>
          <div className="flex gap-1.5">
            {Array.from({ length: total }).map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 ${i < step ? "bg-civic-navy" : "bg-rule-2"}`}
              />
            ))}
          </div>
        </div>

        {/* Card */}
        <div className="border border-rule bg-white px-5 py-7 sm:px-11 sm:py-10">
          <h2 className="mb-1.5 font-serif text-[28px] font-semibold leading-[1.1] tracking-[-0.01em] text-civic-navy">
            {title}
          </h2>
          <hr className="mb-7 mt-3.5 border-0 border-t-[3px] border-double border-rule-dark" />
          {children}
        </div>

        {/* Footer actions */}
        <div className="mt-6 flex items-center justify-between">
          {backHref ? (
            <CivicButton as="link" href={backHref} variant="ghost" size="sm">
              ← Back
            </CivicButton>
          ) : (
            <button
              type="button"
              onClick={() => router.back()}
              className="invisible"
              tabIndex={-1}
            />
          )}
          <CivicButton onClick={onContinue} disabled={continueDisabled} variant="primary">
            {continueLabel} <ArrowIcon className="h-4 w-4" />
          </CivicButton>
        </div>
      </div>
    </div>
  );
}
