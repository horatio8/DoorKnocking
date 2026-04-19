import type { Metadata } from "next";
import Link from "next/link";
import { CivicAdminShell } from "@/components/marketing/civic-admin-shell";
import { TrialBanner } from "@/components/marketing/trial-banner";
import { CivicButton } from "@/components/marketing/civic-button";
import { Eyebrow } from "@/components/marketing/eyebrow";
import { ArrowIcon } from "@/components/marketing/civic-icons";
import { getBillingState } from "@/lib/billing/trial";

export const metadata: Metadata = {
  title: "Empty dashboard — Campaign OS",
};

// 07 · Empty dashboard per design_handoff_onboarding_flow/dashboard.jsx
// EmptyDashboard. Reviewed as the civic-aesthetic preview; promote to the
// real /admin surface when the aesthetic lands.

export const dynamic = "force-dynamic";

export default async function EmptyDashboardDemo() {
  const billing = await getBillingState();
  const planBadge = billing.trialEnded
    ? "TRIAL · ENDED"
    : `TRIAL · ${billing.trialDaysLeft} DAYS LEFT`;

  return (
    <CivicAdminShell
      active="Voters"
      planBadge={planBadge}
      banner={<TrialBanner daysLeft={billing.trialDaysLeft} />}
    >
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <Eyebrow className="mb-1 block">
            SC House District 115 · General · Driving
          </Eyebrow>
          <h2 className="font-serif text-[28px] font-semibold leading-[1.1] tracking-[-0.01em] text-civic-navy">
            Voter roll{" "}
            <span className="font-normal text-mute">· 0 of ~460</span>
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <CivicButton variant="ghost" size="sm">
            Connect Airtable
          </CivicButton>
          <CivicButton variant="primary" size="sm">
            Import voters <ArrowIcon className="h-4 w-4" />
          </CivicButton>
        </div>
      </div>

      {/* Empty state */}
      <div className="border-[1.5px] border-dashed border-rule bg-parchment px-8 py-14 text-center">
        <div className="relative mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border-[1.5px] border-civic-navy">
          <UserIcon className="h-6 w-6 text-civic-navy" />
          <div className="pointer-events-none absolute inset-1 rounded-full border border-civic-navy" />
        </div>
        <h3 className="mb-2 font-serif text-[22px] font-semibold text-civic-navy">
          Bring in your first voters.
        </h3>
        <p className="mx-auto mb-6 max-w-[440px] text-sm text-ink-2">
          Import a CSV from your state voter file, or start with a test file of up to 100
          addresses. We&rsquo;ll geocode them and map them for you.
        </p>
        <div className="flex flex-wrap justify-center gap-2.5">
          <CivicButton variant="primary">Upload CSV</CivicButton>
          <CivicButton variant="ghost">Download sample file</CivicButton>
        </div>
        <Eyebrow className="mt-7 block">Or · explore the product with sample data</Eyebrow>
      </div>

      {/* Preview grid */}
      <div className="mt-6 grid gap-3 md:grid-cols-3">
        <FeatureCard
          title="Generate walkbooks"
          description="Create printable walkbooks from turf & voter lists."
          icon={DocIcon}
        />
        <FeatureCard
          title="Invite volunteers"
          description="Up to 2 free during trial; 20 on your Pro plan."
          icon={UserIcon}
        />
        <FeatureCard
          title="Start a knock session"
          description="Logs offline, syncs when reconnected."
          icon={MapIcon}
          locked
        />
      </div>

      <p className="mt-8 text-center text-xs text-mute">
        Looking for the functional admin?{" "}
        <Link
          href="/admin"
          className="text-civic-navy underline underline-offset-[3px] hover:text-oxblood"
        >
          /admin
        </Link>{" "}
        (separate surface today — this civic shell is the handoff preview).
      </p>
    </CivicAdminShell>
  );
}

function FeatureCard({
  title,
  description,
  icon: Icon,
  locked,
}: {
  title: string;
  description: string;
  icon: (p: React.SVGProps<SVGSVGElement>) => JSX.Element;
  locked?: boolean;
}) {
  return (
    <div
      className={`relative border border-rule bg-white p-4.5 ${locked ? "opacity-60" : ""}`}
      style={{ padding: "18px" }}
    >
      {locked ? (
        <div className="absolute right-3 top-3 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-oxblood">
          <LockIcon className="h-[11px] w-[11px]" /> After card
        </div>
      ) : null}
      <Icon className="mb-2.5 h-5 w-5 text-oxblood" />
      <div className="mb-1 font-serif text-base font-semibold text-civic-navy">{title}</div>
      <div className="text-[12.5px] text-mute">{description}</div>
    </div>
  );
}

function UserIcon(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.3} aria-hidden {...p}>
      <circle cx="8" cy="5.5" r="2.5" />
      <path d="M2.5 14c.5-3 2.8-4.5 5.5-4.5s5 1.5 5.5 4.5" />
    </svg>
  );
}
function DocIcon(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.3} aria-hidden {...p}>
      <path d="M3.5 1.5h6L12.5 4.5v10h-9z" />
      <path d="M9.5 1.5v3h3M5.5 7.5h5M5.5 10h5M5.5 12.5h3" />
    </svg>
  );
}
function MapIcon(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.3} aria-hidden {...p}>
      <path d="M1 3.5l5-1.5 4 1.5 5-1.5v11l-5 1.5-4-1.5-5 1.5z" />
      <path d="M6 2v12M10 3.5v12" />
    </svg>
  );
}
function LockIcon(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.3} aria-hidden {...p}>
      <rect x="3" y="7" width="10" height="7" rx="0.5" />
      <path d="M5 7V5a3 3 0 016 0v2" />
    </svg>
  );
}
