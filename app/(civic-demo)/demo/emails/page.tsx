import type { Metadata } from "next";
import { CampaignOSMark } from "@/components/marketing/campaign-os-mark";
import { CivicButton } from "@/components/marketing/civic-button";
import { Eyebrow } from "@/components/marketing/eyebrow";

export const metadata: Metadata = { title: "Trial emails — Campaign OS" };

// 14 · Trial email templates — six visual-only email cards. Cadence per
// handoff README §9.1: Day 0 welcome, 3 activation, 7 mid-trial, 12
// conversion, 13 final urgency, 14 read-only.

type Email = {
  day: string;
  subject: string;
  kicker: string;
  headline: string;
  body: string;
  cta: string;
  footer: string;
};

const EMAILS: Email[] = [
  {
    day: "0",
    subject: "Welcome to Campaign OS — here's your quick start",
    kicker: "Welcome",
    headline: "Fourteen days. One district. Your move.",
    body: "You're set up for Sprouse for SC 115. Three things to do first: import your voter file (CSV or Airtable), generate a sample walkbook, and invite your first two volunteers.",
    cta: "Open the quick-start guide",
    footer: "You're on a 14-day free trial. No card required until day 14.",
  },
  {
    day: "3",
    subject: "Your first walkbook is waiting",
    kicker: "Activation",
    headline: "The product gets good at the second walkbook.",
    body: "You haven't generated a walkbook yet. Here's one we built from your district — takes 30 seconds to preview. Customize branding, turf cuts, and volunteer assignments from there.",
    cta: "Preview my walkbook",
    footer: "You'll stop receiving activation emails once you generate your first walkbook.",
  },
  {
    day: "7",
    subject: "Halfway through your trial",
    kicker: "Mid-trial",
    headline: "A week in. How's it feeling?",
    body: "You've imported 94 voters and generated 2 walkbooks. At this pace you'll hit your trial cap (100 voters) in about 36 hours. Add a card now and nothing gets interrupted — we won't charge until day 14.",
    cta: "Add a card to continue",
    footer: "Questions? Reply to this email — a real person reads every response.",
  },
  {
    day: "12",
    subject: "Your trial ends in 2 days",
    kicker: "Conversion",
    headline: "Two days left.",
    body: "Your Pro trial ends Thursday at 11:59 PM Eastern. After that, walkbook generation, new imports, and knock sessions are locked until you activate a plan. Your data stays put.",
    cta: "Activate Pro — $199/mo",
    footer: "Need more time? Reply and we'll extend your trial once, no sales call required.",
  },
  {
    day: "13",
    subject: "Don't lose your data",
    kicker: "Final urgency",
    headline: "Tomorrow your account goes read-only.",
    body: "We're not going to keep nagging you. After tomorrow, you can still view and export your 94 voters, 2 walkbooks, and 38 knock events for 30 days. To keep canvassing live, add a card before midnight.",
    cta: "Add a card now",
    footer: "Export everything to CSV anytime from Settings → Export.",
  },
  {
    day: "14",
    subject: "Your trial has ended",
    kicker: "Read-only",
    headline: "Your trial has ended — your data is safe.",
    body: "No card on file yet, so your account is now read-only. You have 30 days to activate a plan before the data is archived, and 90 days before final deletion. Need an extension? Just ask.",
    cta: "Activate a plan",
    footer: "This is the last email you'll receive unless you reply or reactivate.",
  },
];

export default function EmailsPage() {
  return (
    <div className="bg-paper px-8 py-10">
      <div className="mx-auto max-w-[1200px]">
        <div className="mb-8 text-center">
          <Eyebrow variant="oxblood" className="mb-2 block">
            §9.1 · Trial cadence via Resend
          </Eyebrow>
          <h2 className="font-serif text-[30px] font-semibold leading-[1.1] tracking-[-0.01em] text-civic-navy">
            Six emails over fourteen days.
          </h2>
          <p className="mx-auto mt-3 max-w-[520px] text-sm text-mute">
            Each email is short, serif-led, and carries a single CTA. No emoji, no stock photos.
            The language escalates from welcome → nudge → urgency.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {EMAILS.map((e) => (
            <EmailCard key={e.day} email={e} />
          ))}
        </div>
      </div>
    </div>
  );
}

function EmailCard({ email }: { email: Email }) {
  return (
    <article className="overflow-hidden border border-rule bg-white">
      <header className="flex items-center justify-between border-b border-rule-2 bg-parchment-2 px-4 py-2 text-[11px] text-mute">
        <span>
          <strong>Campaign OS</strong> &lt;hello@campaignos.com&gt;
        </span>
        <span className="font-mono tabular-nums">DAY {email.day}</span>
      </header>
      <div className="border-b border-rule-2 px-4 py-1.5 text-sm">
        <strong>Subject:</strong> {email.subject}
      </div>
      <div className="bg-paper px-7 pb-6 pt-7">
        <div className="mb-4 flex items-center gap-2 text-civic-navy">
          <CampaignOSMark size={18} />
          <span className="font-serif text-sm font-semibold">Campaign OS</span>
        </div>
        <Eyebrow variant="oxblood" className="mb-2 block">
          {email.kicker}
        </Eyebrow>
        <div className="mb-3.5 font-serif text-[22px] font-semibold leading-[1.2] text-civic-navy">
          {email.headline}
        </div>
        <p className="mb-4.5 text-sm leading-[1.55] text-ink-2">{email.body}</p>
        <CivicButton
          variant="primary"
          size="sm"
          className="pointer-events-none"
          tabIndex={-1}
        >
          {email.cta} →
        </CivicButton>
        <div className="mt-5 border-t border-rule-2 pt-3.5 text-[11px] text-mute">
          {email.footer}
        </div>
      </div>
    </article>
  );
}
