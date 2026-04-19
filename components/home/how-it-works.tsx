import { SectionHead } from "./section-head";

const STEPS: Array<{ num: string; time: string; title: string; body: string; tag: string }> = [
  {
    num: "STEP 01",
    time: "2 min",
    title: "Sign up & verify",
    body: "Email and password. We send a verification link, you click it, you're in. No card until day 14.",
    tag: "/signup → /verify",
  },
  {
    num: "STEP 02",
    time: "3 min",
    title: "Guided setup",
    body: "Tell us who you are, what race you're running, and which district. Optionally connect your own Airtable base.",
    tag: "/setup/{role,campaign,district}",
  },
  {
    num: "STEP 03",
    time: "5 min",
    title: "Import & knock",
    body: "Upload a CSV or sync Airtable. We geocode, cut turf, and generate your first walkbook. Start knocking.",
    tag: "/admin/voters → walkbook.pdf",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="py-[84px]">
      <div className="mx-auto max-w-[1200px] px-8">
        <SectionHead
          starSep
          eyebrow="§1 · How it works"
          heading="Landing page to imported voters in under ten minutes."
          body={`No sales call, no implementation fees, no "book a demo" wall. Three steps from the trial signup to your first knock.`}
        />
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {STEPS.map((s) => (
            <article key={s.num} className="relative border border-rule bg-white px-[26px] py-7">
              <div className="mb-3.5 font-mono text-[11px] font-semibold tracking-[0.14em] text-oxblood">
                {s.num} · {s.time}
              </div>
              <h3 className="mb-2 font-serif text-[22px] font-semibold leading-[1.25] text-civic-navy">
                {s.title}
              </h3>
              <p className="text-[14px] leading-[1.55] text-ink-2">{s.body}</p>
              <div className="mt-4 font-mono text-[11px] text-mute">{s.tag}</div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
