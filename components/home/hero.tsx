import { TrackedLink } from "@/components/marketing/tracked-link";
import { CampaignOSMark } from "@/components/marketing/campaign-os-mark";

// Navy hero with dot-pattern overlay + product mock on the right. The mock
// is static per handoff §7 (could become clickable later). Keep the exact
// copy — flagged as approved-copy in the spec.

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-rule-dark bg-civic-navy px-0 py-[72px] text-parchment md:py-20">
      <div className="pointer-events-none absolute inset-0 opacity-50" aria-hidden style={dotPattern} />
      <div className="relative mx-auto grid max-w-[1200px] grid-cols-1 items-center gap-14 px-8 md:grid-cols-[1.05fr_1fr]">
        <div>
          <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-parchment/30 px-3 py-1.5 font-sans text-[10.5px] font-semibold uppercase tracking-[0.18em] text-parchment/85">
            <span className="h-[5px] w-[5px] rounded-full bg-oxblood" />
            Campaign OS · Est. 2024
          </span>
          <h1 className="mb-[22px] font-serif text-[44px] font-semibold leading-[1.02] tracking-[-0.025em] text-parchment md:text-[64px]">
            Door-knock software for{" "}
            <em className="font-serif italic text-oxblood">serious campaigns.</em>
          </h1>
          <p className="mb-8 max-w-[520px] text-[18px] leading-[1.55] text-parchment/80">
            District-agnostic field operations for professional campaign teams. Import a voter
            file, cut turf, print walkbooks, knock, listen, record — all in one place.
          </p>
          <div className="mb-7 flex flex-wrap gap-3">
            <TrackedLink
              href="/signup"
              event="signup_cta_clicked"
              eventProps={{ location: "hero_primary" }}
              className="inline-flex items-center justify-center gap-2 rounded-sm border border-oxblood bg-oxblood px-7 py-[15px] text-[15px] font-semibold text-parchment no-underline transition-colors hover:bg-oxblood-2"
            >
              Start 14-day free trial →
            </TrackedLink>
            <a
              href="#how"
              className="inline-flex items-center justify-center gap-2 rounded-sm border border-parchment/35 bg-transparent px-7 py-[15px] text-[15px] font-semibold text-parchment no-underline transition-colors hover:border-parchment hover:bg-parchment/[0.08]"
            >
              See it in action
            </a>
          </div>
          <ul className="flex flex-wrap gap-[18px] text-xs text-parchment/55">
            <li className="inline-flex items-center gap-1.5">
              <ShieldIcon /> No credit card required
            </li>
            <li className="inline-flex items-center gap-1.5">
              <ClockIcon /> Live in under 10 minutes
            </li>
            <li className="inline-flex items-center gap-1.5">
              <FlagIcon /> US + AU + CA hosted
            </li>
          </ul>
        </div>

        <HeroMock />
      </div>
    </section>
  );
}

const dotPattern = {
  backgroundImage: [
    "radial-gradient(circle at 18% 22%, rgba(247,243,236,0.5) 0.6px, transparent 1px)",
    "radial-gradient(circle at 52% 38%, rgba(247,243,236,0.4) 0.5px, transparent 1px)",
    "radial-gradient(circle at 82% 18%, rgba(247,243,236,0.5) 0.6px, transparent 1px)",
    "radial-gradient(circle at 28% 72%, rgba(247,243,236,0.4) 0.5px, transparent 1px)",
    "radial-gradient(circle at 74% 68%, rgba(247,243,236,0.5) 0.6px, transparent 1px)",
  ].join(","),
  backgroundSize: "120px 120px",
} as const;

function HeroMock() {
  return (
    <div
      role="img"
      aria-label="Knock admin — voter roll"
      className="relative border border-rule-dark bg-paper shadow-[0_40px_60px_-24px_rgba(0,0,0,0.45)]"
    >
      <div className="flex h-[26px] items-center gap-[5px] border-b border-rule bg-parchment px-2.5">
        <span className="h-[7px] w-[7px] rounded-full" style={{ backgroundColor: "#D96D5C" }} />
        <span className="h-[7px] w-[7px] rounded-full" style={{ backgroundColor: "#D9A83C" }} />
        <span className="h-[7px] w-[7px] rounded-full" style={{ backgroundColor: "#6E9C5B" }} />
        <span className="ml-3 font-mono text-[10px] text-mute">app.knock.campaign/admin/voters</span>
      </div>
      <div className="grid grid-cols-[84px_1fr]">
        <aside className="bg-civic-navy px-2.5 py-3.5 text-parchment">
          <div className="mb-3.5 flex items-center gap-1.5 font-serif text-[11px] font-semibold">
            <CampaignOSMark size={12} />
            Knock
          </div>
          <div className="grid gap-1 text-[10.5px]">
            {["Overview", "Voters", "Walkbooks", "Turf", "Volunteers"].map((label) => (
              <span
                key={label}
                className={`px-[7px] py-[5px] ${
                  label === "Voters" ? "bg-parchment/10 text-parchment" : "text-parchment/60"
                }`}
              >
                {label}
              </span>
            ))}
          </div>
        </aside>
        <div className="min-h-[360px] px-5 py-[18px]">
          <div className="mb-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-oxblood">
            SC House 115 · General
          </div>
          <div className="mb-3.5 font-serif text-[19px] font-semibold text-civic-navy">
            Voter roll · 460
          </div>
          <div className="mb-3.5 flex items-center justify-between border border-rule-2 bg-parchment px-2.5 py-2 text-[10px] text-ink-2">
            <span>
              <strong className="text-civic-navy">14-day trial</strong> · 13 days remaining
            </span>
            <span className="rounded-[2px] bg-oxblood px-[7px] py-[3px] text-[9px] font-semibold text-parchment">
              Add card →
            </span>
          </div>
          {MOCK_VOTERS.map((row, i) => (
            <div
              key={row[0]}
              className={`grid grid-cols-[1.4fr_0.8fr_0.4fr_0.5fr] items-center gap-2.5 border-b border-dashed border-rule-2 py-2 text-[10.5px] ${
                i === MOCK_VOTERS.length - 1 ? "border-b-0" : ""
              }`}
            >
              <span className="font-serif font-semibold text-ink">{row[0]}</span>
              <span className="font-mono text-[9.5px] text-mute">{row[1]}</span>
              <span
                className={`inline-block border px-[5px] py-[1px] text-[8.5px] font-semibold tracking-[0.1em] ${
                  row[2] === "R" ? "text-oxblood" : row[2] === "D" ? "text-civic-navy" : "text-mute"
                }`}
                style={{ borderColor: "currentColor" }}
              >
                {row[2]}
              </span>
              <span>{row[3]}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="absolute -bottom-7 -right-4 rotate-[-2deg] border border-rule bg-parchment px-3.5 py-2.5 font-mono text-[10px] text-civic-navy shadow-[0_8px_20px_-8px_rgba(0,0,0,0.2)]">
        <strong className="text-oxblood">★ 99.9%</strong> uptime · SOC 2
      </div>
    </div>
  );
}

const MOCK_VOTERS: Array<[string, string, "R" | "D" | "I", string]> = [
  ["Ashford, Margaret H.", "127 Queen St", "R", "Turf 3"],
  ["Beauchamp, Everett L.", "219 Meeting St", "I", "Turf 3"],
  ["Crawford, Henrietta", "44 Broad St", "D", "Turf 1"],
  ["Dennison, Robert W.", "2 King St", "R", "Turf 1"],
  ["Ellington, Margaret", "81 Tradd St", "R", "Turf 2"],
  ["Faulkner, James P.", "55 Church St", "D", "Turf 2"],
];

function ShieldIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.3} aria-hidden>
      <path d="M8 1.5l5.5 2v4.2c0 3.2-2.2 5.8-5.5 6.8-3.3-1-5.5-3.6-5.5-6.8V3.5z" />
      <path d="M5.5 8l2 2 3-3.5" />
    </svg>
  );
}
function ClockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.3} aria-hidden>
      <circle cx="8" cy="8" r="6.5" />
      <path d="M8 5v3.5L10.5 10" />
    </svg>
  );
}
function FlagIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.3} aria-hidden>
      <path d="M3 14V2M3 3h9l-2 3 2 3H3" />
    </svg>
  );
}
