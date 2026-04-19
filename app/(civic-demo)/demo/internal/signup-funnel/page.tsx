import type { Metadata } from "next";
import { CivicButton } from "@/components/marketing/civic-button";
import { CivicBadge } from "@/components/marketing/civic-badge";
import { CivicSelect } from "@/components/marketing/civic-input";
import { Eyebrow } from "@/components/marketing/eyebrow";

export const metadata: Metadata = { title: "Signup funnel — Campaign OS (internal)" };

// 15 · Internal funnel dashboard — KPIs + drop-off + UTM + friction flags.
// Per handoff README §15.

type Step = { l: string; n: number; target?: number };
const STEPS: Step[] = [
  { l: "Pricing page viewed", n: 8421 },
  { l: "Signup started", n: 1247, target: 8 },
  { l: "Email verified", n: 1128, target: 85 },
  { l: "Wizard step 1", n: 1092 },
  { l: "Wizard step 2", n: 1041 },
  { l: "Wizard complete", n: 984, target: 90 },
  { l: "Paywall viewed", n: 712, target: 60 },
  { l: "Card captured", n: 327, target: 40 },
  { l: "First voter imported", n: 281 },
];

type Kpi = { l: string; n: string; d: string; ok: boolean | null; spark: number[] };
const KPIS: Kpi[] = [
  {
    l: "New paying customers",
    n: "327",
    d: "+18% vs prev",
    ok: true,
    spark: [2, 5, 3, 6, 4, 8, 7, 9, 11, 12, 14, 18],
  },
  {
    l: "Trial → paid conversion",
    n: "33.2%",
    d: "target 25%",
    ok: true,
    spark: [22, 25, 28, 26, 30, 31, 29, 32, 33, 33],
  },
  {
    l: "Median time to paid",
    n: "11m 42s",
    d: "target <15m",
    ok: true,
    spark: [18, 17, 15, 14, 13, 12, 12, 11, 11, 11],
  },
  {
    l: "Paywall skip rate",
    n: "54.1%",
    d: "retarget @ d7/d12",
    ok: null,
    spark: [52, 54, 55, 53, 54, 54, 54],
  },
];

const UTM: Array<[string, number, number, number, string]> = [
  ["organic", 3120, 441, 127, "4.1%"],
  ["twitter", 1842, 312, 84, "4.6%"],
  ["newsletter/punchbowl", 1204, 198, 61, "5.1%"],
  ["referral", 892, 161, 38, "4.3%"],
  ["google/cpc", 743, 92, 12, "1.6%"],
];

const FLAGS: Array<{ c: "oxblood" | "amber" | "mute"; t: string; d: string }> = [
  { c: "oxblood", t: "Google CPC converting at 1.6%", d: "Half of the site average. Check landing-page copy." },
  { c: "amber", t: "Paywall skip = 54% on annual", d: "Monthly default may help; test this week." },
  { c: "mute", t: "12 enterprise prospects auto-routed", d: "F500 domains redirected to sales calendar." },
];

export default function FunnelPage() {
  return (
    <div className="min-h-screen bg-paper">
      {/* Internal banner */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-rule-dark px-6 py-2.5 text-xs text-parchment">
        <span>
          <span className="font-mono tracking-[0.1em] text-oxblood">● INTERNAL</span>{" "}
          &nbsp;&nbsp; /admin/internal/signup-funnel &nbsp;·&nbsp; teller.co employees only
        </span>
        <span className="font-mono text-parchment/50 tabular-nums">
          Last updated 2m ago · Auto-refresh 15m
        </span>
      </div>

      <div className="px-8 py-7">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <Eyebrow variant="oxblood" className="mb-1 block">
              Growth · Signup funnel
            </Eyebrow>
            <h2 className="font-serif text-[28px] font-semibold leading-[1.1] tracking-[-0.01em] text-civic-navy">
              Self-serve conversion, last 30 days
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <CivicSelect defaultValue="Last 30 days" className="w-[180px] text-[13px]">
              <option>Last 30 days</option>
              <option>Last 7 days</option>
              <option>This quarter</option>
            </CivicSelect>
            <CivicButton variant="ghost" size="sm">
              Export CSV
            </CivicButton>
          </div>
        </div>

        {/* KPIs */}
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {KPIS.map((k) => (
            <div key={k.l} className="border border-rule bg-white p-[18px]">
              <Eyebrow className="mb-1.5 block">{k.l}</Eyebrow>
              <div className="flex items-end justify-between">
                <div className="font-serif font-mono text-[28px] font-semibold tabular-nums text-civic-navy">
                  {k.n}
                </div>
                <Spark data={k.spark} oxblood={k.ok === null} w={70} h={26} />
              </div>
              <div
                className={`mt-1 text-[11px] ${k.ok ? "text-civic-green" : "text-mute"}`}
              >
                {k.d}
              </div>
            </div>
          ))}
        </div>

        {/* Funnel */}
        <div className="mb-6 border border-rule bg-white">
          <div className="border-b border-rule-2 px-6 py-4">
            <Eyebrow variant="oxblood">§ 3 · Funnel drop-off</Eyebrow>
            <div className="mt-1 font-serif text-[20px] font-semibold">
              Every step from landing to imported voters
            </div>
          </div>
          <div className="px-6 py-5">
            {STEPS.map((s, i) => {
              const width = (s.n / STEPS[0]!.n) * 100;
              const stepPct = i > 0 ? (s.n / STEPS[i - 1]!.n) * 100 : 100;
              const meetsTarget = s.target == null ? null : stepPct >= s.target;
              return (
                <div
                  key={s.l}
                  className={`grid items-center gap-4 py-2.5 ${i < STEPS.length - 1 ? "border-b border-dashed border-rule-2" : ""}`}
                  style={{ gridTemplateColumns: "220px 1fr 90px 90px 110px" }}
                >
                  <div className="flex items-center gap-2 text-[13px]">
                    <span className="font-mono text-[10px] tracking-[0.1em] text-mute tabular-nums">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {s.l}
                  </div>
                  <div className="relative h-[22px] bg-parchment">
                    <div
                      className={`h-full ${i === 0 ? "bg-civic-navy-3" : meetsTarget === false ? "bg-oxblood" : "bg-civic-navy"}`}
                      style={{ width: `${width}%` }}
                    />
                  </div>
                  <div className="text-right font-mono text-[13px] font-semibold tabular-nums">
                    {s.n.toLocaleString()}
                  </div>
                  <div className="text-right font-mono text-xs tabular-nums text-mute">
                    {i > 0 ? `${stepPct.toFixed(1)}%` : "100%"}
                  </div>
                  <div className="text-right text-[10px]">
                    {s.target ? (
                      <span
                        className={`font-semibold tracking-[0.08em] ${meetsTarget ? "text-civic-green" : "text-oxblood"}`}
                      >
                        {meetsTarget ? "✓" : "✕"} TGT {s.target}%
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom row */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.4fr_1fr]">
          <div className="border border-rule bg-white">
            <div className="border-b border-rule-2 px-5 py-4">
              <Eyebrow variant="oxblood">By acquisition source</Eyebrow>
              <div className="mt-0.5 font-serif text-base font-semibold">
                Top channels · 30 days
              </div>
            </div>
            <table className="w-full text-left text-sm">
              <thead className="bg-parchment">
                <tr className="text-[11px] uppercase tracking-[0.08em] text-mute">
                  <th className="px-5 py-3 font-semibold">UTM source</th>
                  <th className="px-3 py-3 font-semibold">Pricing views</th>
                  <th className="px-3 py-3 font-semibold">Signups</th>
                  <th className="px-3 py-3 font-semibold">Paid</th>
                  <th className="px-3 py-3 font-semibold">CVR</th>
                </tr>
              </thead>
              <tbody>
                {UTM.map((r) => {
                  const cvrOk = parseFloat(r[4] as string) >= 4;
                  return (
                    <tr key={r[0]} className="border-t border-rule-2">
                      <td className="px-5 py-3 font-mono text-xs">{r[0]}</td>
                      <td className="px-3 py-3 font-mono tabular-nums">
                        {(r[1] as number).toLocaleString()}
                      </td>
                      <td className="px-3 py-3 font-mono tabular-nums">{r[2]}</td>
                      <td className="px-3 py-3 font-mono font-semibold tabular-nums">{r[3]}</td>
                      <td
                        className={`px-3 py-3 font-mono tabular-nums ${cvrOk ? "text-civic-green" : "text-oxblood"}`}
                      >
                        {r[4]}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="border border-rule bg-white p-5">
            <Eyebrow variant="oxblood" className="mb-1.5 block">
              Friction flags
            </Eyebrow>
            <div className="mb-3.5 font-serif text-base font-semibold">Things worth looking at</div>
            <ul className="grid gap-2.5 text-[13px]">
              {FLAGS.map((f, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2.5 border border-rule-2 bg-paper p-3"
                >
                  <CivicBadge variant={f.c} solid dot>
                    {" "}
                  </CivicBadge>
                  <div>
                    <div className="text-[12.5px] font-semibold">{f.t}</div>
                    <div className="mt-0.5 text-[11.5px] text-mute">{f.d}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function Spark({
  data,
  oxblood,
  w = 120,
  h = 36,
}: {
  data: number[];
  oxblood?: boolean;
  w?: number;
  h?: number;
}) {
  const max = Math.max(...data);
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / max) * h * 0.9 - 2}`)
    .join(" ");
  return (
    <svg width={w} height={h} className="block" aria-hidden>
      <polyline
        points={pts}
        fill="none"
        stroke={oxblood ? "#8B2635" : "#0B2545"}
        strokeWidth={1.3}
      />
    </svg>
  );
}
