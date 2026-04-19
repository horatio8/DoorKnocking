import { CivicButton } from "./civic-button";
import { ArrowIcon } from "./civic-icons";

// 07 · Trial banner that sits on top of the admin main area while the user
// is trialing. Parchment fill, star eyebrow, oxblood CTA.
export function TrialBanner({ daysLeft = 13 }: { daysLeft?: number }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-rule bg-parchment px-6 py-2.5 text-sm">
      <div className="flex items-center gap-2.5">
        <span className="text-[9px] tracking-[0.3em] text-oxblood">★★★</span>
        <span className="text-ink-2">
          You&rsquo;re on a <strong className="text-civic-navy">14-day free trial</strong> ·{" "}
          <span className="font-mono tabular-nums">{daysLeft} days</span> remaining · Import up to
          100 voters before adding a card.
        </span>
      </div>
      <CivicButton as="link" href="/billing/activate" variant="oxblood" size="sm">
        Add card &amp; unlock <ArrowIcon className="h-4 w-4" />
      </CivicButton>
    </div>
  );
}
