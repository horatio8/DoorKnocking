const BULLETS = [
  "Voter one-liner per stop, grounded in their actual record.",
  "1,000 minutes of voice transcription on Pro.",
  `Nightly "what we learned" email for the candidate.`,
  "Never trained on your voter data. Ever.",
];

export function FeatureAI() {
  return (
    <section className="bg-paper py-24">
      <div className="mx-auto max-w-[1200px] px-8">
        <div className="grid grid-cols-1 items-center gap-14 md:grid-cols-2">
          {/* Navy visual — kept first in DOM, reordered visually on desktop */}
          <div className="order-2 border border-civic-navy bg-civic-navy p-6 text-parchment md:order-2">
            <div className="mb-2 font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-oxblood">
              Voter one-liner · Auto
            </div>
            <p className="mb-[18px] font-serif text-base leading-[1.45]">
              “Margaret votes every cycle and owns her home.{" "}
              <span className="text-oxblood">Lead with property taxes</span> — don&rsquo;t mention
              schools, no kids in district.”
            </p>
            <p className="font-mono text-[10px] tracking-[0.08em] text-parchment/50">
              — Generated 3s ago · grounded in voter file + 3 public records
            </p>
            <hr className="my-[22px] border-0 border-t border-parchment/15" />
            <div className="mb-2 font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-oxblood">
              Post-session debrief
            </div>
            <p className="font-serif text-[13.5px] italic leading-[1.55] text-parchment/90">
              Turf 3 complete — 42 stops, 19 contacts. Top concerns: property taxes (8), school
              zoning (4), flooding (3). Two voters requested yard signs.
            </p>
            <div className="mt-4 flex items-center justify-between font-mono text-[10px] text-parchment/50">
              <span>●REC 14:22</span>
              <span>Auto-emailed to candidate</span>
            </div>
          </div>

          <div className="order-1 md:order-1">
            <div className="mb-2.5 font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-oxblood">
              §3 · AI where it helps
            </div>
            <h2 className="mb-3.5 font-serif text-[34px] font-semibold leading-[1.08] tracking-[-0.01em] text-civic-navy">
              One-liners, transcriptions, debriefs. No AI theater.
            </h2>
            <p className="mb-[18px] text-base leading-[1.6] text-ink-2">
              Your volunteers get a single crisp line for each voter — the one thing that will
              land at this door. When they&rsquo;re back in the car, they dictate what happened.
              We transcribe, tag issues, and roll it into a nightly debrief.
            </p>
            <ul className="mt-[18px] grid list-none gap-2.5 p-0">
              {BULLETS.map((b) => (
                <li key={b} className="flex items-start gap-2.5 text-[14.5px] text-ink-2">
                  <span className="mt-[3px] flex-shrink-0 text-oxblood">✓</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
