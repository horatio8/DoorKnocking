// Trust strip — 4 stats. Numbers are PM-approved placeholders; flagged in
// the pre-flight audit for accuracy before launch.

const STATS: Array<{ n: string; l: string }> = [
  { n: "347", l: "campaigns run" },
  { n: "1.2M", l: "doors knocked" },
  { n: "28", l: "states served" },
  { n: "99.9%", l: "uptime, verified" },
];

export function TrustStrip() {
  return (
    <div className="border-b border-rule bg-parchment py-9">
      <div className="mx-auto grid max-w-[1200px] grid-cols-1 items-center gap-12 px-8 md:grid-cols-[auto_1fr]">
        <p className="max-w-[240px] font-serif text-[15px] italic text-mute">
          Trusted by campaigns who take their data seriously.
        </p>
        <div className="grid grid-cols-2 gap-6 md:grid-cols-4 md:border-l md:border-rule md:pl-12">
          {STATS.map((s) => (
            <div key={s.l}>
              <div className="font-serif font-mono text-[30px] font-semibold leading-none tabular-nums text-civic-navy">
                {s.n}
              </div>
              <div className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-mute">
                {s.l}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
