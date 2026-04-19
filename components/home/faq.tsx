import { SectionHead } from "./section-head";

const ITEMS: Array<{ q: string; a: string; open?: boolean }> = [
  {
    q: "Do I need a credit card to start?",
    a: "No. Your 14-day trial includes up to 100 imported voters and unlimited knock events. We ask for a card on day 14 — or you can export everything and walk away.",
    open: true,
  },
  {
    q: "Is my voter data safe?",
    a: "Yes. SOC 2 Type II, encrypted at rest and in transit, US/AU/CA-hosted by region, with row-level security on every table. We never train AI on your voter data.",
  },
  {
    q: "Can I bring my own Airtable base?",
    a: "Yes — and we recommend it on Pro and Agency. Connect a Personal Access Token during setup and everything syncs both ways. Your data, your schema.",
  },
  {
    q: "What happens if my trial ends?",
    a: "Your account goes read-only — you keep 30 days of full read and export access, then 90 days of archive. Add a card any time to re-activate.",
  },
  {
    q: "Does this work internationally?",
    a: "Knock is district-agnostic. We run campaigns in US states, Australian federal/state seats, and Canadian ridings. Turf, voter-file imports and mapping adapt automatically.",
  },
  {
    q: "Can I cancel?",
    a: "One click in Settings → Billing. No phone call, no retention offer, no exit survey. You'll keep access until the end of the current billing period.",
  },
];

export function FAQ() {
  return (
    <div id="faq" className="border-t border-rule bg-parchment">
      <section className="py-[84px]">
        <div className="mx-auto max-w-[1200px] px-8">
          <SectionHead eyebrow="§4 · Questions" heading="Straight answers." />
          <div className="mx-auto grid max-w-[1000px] grid-cols-1 gap-x-10 gap-y-3 md:grid-cols-2">
            {ITEMS.map((item) => (
              <details
                key={item.q}
                open={item.open}
                className="group border-b border-rule py-[18px] [&[open]_.faq-plus]:hidden [&[open]_.faq-minus]:inline"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-serif text-[17px] font-semibold text-civic-navy [&::-webkit-details-marker]:hidden">
                  <span>{item.q}</span>
                  <span aria-hidden className="font-mono text-[20px] font-normal text-oxblood">
                    <span className="faq-plus">+</span>
                    <span className="faq-minus hidden">−</span>
                  </span>
                </summary>
                <p className="mt-2.5 text-[14.5px] leading-[1.6] text-ink-2">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
