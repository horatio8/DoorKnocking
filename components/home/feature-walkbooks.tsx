const BULLETS = [
  "Ordered by optimal walk route — not alphabetical.",
  "Custom candidate branding on every page.",
  "QR code on each stop syncs back when volunteers finish.",
  "Offline-ready. Works on paper when the signal dies.",
];

const STOPS: Array<[string, string, string, "R" | "D" | "I"]> = [
  ["01", "Ashford, Margaret H.", "127 Queen St · age 67 · voted 22,20,18", "R"],
  ["02", "Beauchamp, Everett L.", "219 Meeting St · age 42 · voted 22,20", "I"],
  ["03", "Callaway, Dorothea", "311 Meeting St · age 58 · voted 22", "R"],
  ["04", "Donaldson, Philip", "48 Broad St · age 73 · voted 22,20,18,16", "R"],
  ["05", "Ellington, Margaret", "81 Tradd St · age 34 · voted 22,20", "R"],
];

export function FeatureWalkbooks() {
  return (
    <div id="features" className="border-y border-rule bg-parchment">
      <section className="py-24">
        <div className="mx-auto max-w-[1200px] px-8">
          <div className="grid grid-cols-1 items-center gap-14 md:grid-cols-2">
            <div>
              <div className="mb-2.5 font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-oxblood">
                §2 · Walkbooks
              </div>
              <h2 className="mb-3.5 font-serif text-[34px] font-semibold leading-[1.08] tracking-[-0.01em] text-civic-navy">
                Printable walkbooks volunteers actually want to carry.
              </h2>
              <p className="mb-[18px] text-base leading-[1.6] text-ink-2">
                Not a spreadsheet dump. Serif-set, turf-ordered, branded to the campaign, with a
                script, issue flags, and space for handwritten notes on every stop.
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
            <div className="border border-rule bg-white p-5">
              <div className="font-serif text-ink">
                <div className="mb-3.5 flex items-baseline justify-between border-b-[3px] border-double border-rule-dark pb-2.5">
                  <div className="text-lg font-semibold text-civic-navy">Walkbook · Turf 3 North</div>
                  <div className="font-mono text-[10px] text-mute">SHEET 02 / 04</div>
                </div>
                {STOPS.map((s, i) => (
                  <div
                    key={s[0]}
                    className={`grid grid-cols-[28px_1fr_auto] items-center gap-2.5 border-b border-dashed border-rule-2 py-2.5 font-sans ${
                      i === STOPS.length - 1 ? "border-b-0" : ""
                    }`}
                  >
                    <span className="font-mono text-[11px] font-semibold text-oxblood">{s[0]}</span>
                    <div>
                      <div className="font-serif text-[13.5px] font-semibold text-ink">{s[1]}</div>
                      <div className="mt-px font-mono text-[10.5px] text-mute">{s[2]}</div>
                    </div>
                    <span
                      className={`border px-[5px] py-[2px] text-[9px] font-semibold tracking-[0.1em] ${
                        s[3] === "R" ? "text-oxblood" : s[3] === "D" ? "text-civic-navy" : "text-mute"
                      }`}
                      style={{ borderColor: "currentColor" }}
                    >
                      {s[3]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
