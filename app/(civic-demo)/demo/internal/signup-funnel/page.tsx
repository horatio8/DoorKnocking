import type { Metadata } from "next";
import { CivicButton } from "@/components/marketing/civic-button";
import { CivicBadge } from "@/components/marketing/civic-badge";
import { CivicSelect } from "@/components/marketing/civic-input";
import { Eyebrow } from "@/components/marketing/eyebrow";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Signup funnel — Campaign OS (internal)",
};
export const dynamic = "force-dynamic";

// 15 · Internal funnel dashboard. Reads real counts from signup_funnel_events
// (last 30 days). Fall-through zeros when the table's empty.

const STEP_DEFS: Array<{ key: string; label: string; target?: number }> = [
  { key: "pricing_viewed", label: "Pricing page viewed" },
  { key: "signup_started", label: "Signup started", target: 8 },
  { key: "email_verified", label: "Email verified", target: 85 },
  { key: "wizard_step_1", label: "Wizard step 1" },
  { key: "wizard_step_2", label: "Wizard step 2" },
  { key: "wizard_complete", label: "Wizard complete", target: 90 },
  { key: "paywall_viewed", label: "Paywall viewed", target: 60 },
  { key: "paywall_completed", label: "Card captured", target: 40 },
  { key: "first_voter_imported", label: "First voter imported" },
];

export default async function FunnelPage() {
  const supabase = getSupabaseServiceRoleClient();
  const since = new Date(Date.now() - 30 * 86400 * 1000).toISOString();

  const { data: rows } = await supabase
    .from("signup_funnel_events")
    .select("event")
    .gte("occurred_at", since);
  const counts = new Map<string, number>();
  for (const r of (rows ?? []) as Array<{ event: string }>) {
    counts.set(r.event, (counts.get(r.event) ?? 0) + 1);
  }
  const steps = STEP_DEFS.map((d) => ({ ...d, n: counts.get(d.key) ?? 0 }));
  const topN = Math.max(...steps.map((s) => s.n), 1);
  const signupTotal = counts.get("signup_submitted") ?? counts.get("signup_started") ?? 0;
  const paid = counts.get("paywall_completed") ?? 0;
  const paywalled = counts.get("paywall_viewed") ?? 0;
  const skipped = counts.get("paywall_skipped") ?? 0;
  const trialToPaidPct = signupTotal > 0 ? Math.round((paid / signupTotal) * 1000) / 10 : 0;
  const paywallSkipPct = paywalled > 0 ? Math.round((skipped / paywalled) * 1000) / 10 : 0;

  return (
    <div className="min-h-screen bg-paper">
      {/* Internal banner */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-rule-dark px-6 py-2.5 text-xs text-parchment">
        <span>
          <span className="font-mono tracking-[0.1em] text-oxblood">● INTERNAL</span>{" "}
          &nbsp;&nbsp; /demo/internal/signup-funnel &nbsp;·&nbsp; teller.co employees only
        </span>
        <span className="font-mono text-parchment/50 tabular-nums">
          Live from signup_funnel_events · last 30d
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
          <Kpi label="New paying customers" value={paid.toLocaleString()} note="last 30 days" />
          <Kpi
            label="Trial → paid conversion"
            value={`${trialToPaidPct}%`}
            note={`${paid} paid / ${signupTotal} signups`}
            good={trialToPaidPct >= 25}
          />
          <Kpi
            label="Paywall skip rate"
            value={`${paywallSkipPct}%`}
            note={`${skipped} skipped / ${paywalled} viewed`}
          />
          <Kpi
            label="Pricing views"
            value={(counts.get("pricing_viewed") ?? 0).toLocaleString()}
            note="top of funnel"
          />
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
            {steps.map((s, i) => {
              const width = (s.n / topN) * 100;
              const prev = i > 0 ? steps[i - 1]!.n : s.n;
              const stepPct = prev > 0 ? (s.n / prev) * 100 : 0;
              const meetsTarget = s.target == null ? null : stepPct >= s.target;
              return (
                <div
                  key={s.key}
                  className={`grid items-center gap-4 py-2.5 ${i < steps.length - 1 ? "border-b border-dashed border-rule-2" : ""}`}
                  style={{ gridTemplateColumns: "220px 1fr 90px 90px 110px" }}
                >
                  <div className="flex items-center gap-2 text-[13px]">
                    <span className="font-mono text-[10px] tracking-[0.1em] text-mute tabular-nums">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {s.label}
                  </div>
                  <div className="relative h-[22px] bg-parchment">
                    <div
                      className={`h-full ${
                        i === 0
                          ? "bg-civic-navy-3"
                          : meetsTarget === false
                            ? "bg-oxblood"
                            : "bg-civic-navy"
                      }`}
                      style={{ width: `${width}%` }}
                    />
                  </div>
                  <div className="text-right font-mono text-[13px] font-semibold tabular-nums">
                    {s.n.toLocaleString()}
                  </div>
                  <div className="text-right font-mono text-xs tabular-nums text-mute">
                    {i > 0 ? `${stepPct.toFixed(1)}%` : "—"}
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
            {rows?.length === 0 ? (
              <p className="mt-4 text-center text-xs text-mute">
                No events yet — fire the flow from /pricing → /signup → … to see data here.
              </p>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.4fr_1fr]">
          <div className="border border-rule bg-white p-5">
            <Eyebrow variant="oxblood" className="mb-1.5 block">
              By acquisition source
            </Eyebrow>
            <div className="mb-3 font-serif text-base font-semibold">UTM breakdown</div>
            <p className="text-xs text-mute">
              Once UTM data is flowing, this panel will break down signups by{" "}
              <code className="font-mono">utm_source</code> /{" "}
              <code className="font-mono">utm_medium</code>. Today&rsquo;s totals are in the KPI
              row above.
            </p>
          </div>
          <div className="border border-rule bg-white p-5">
            <Eyebrow variant="oxblood" className="mb-1.5 block">
              Friction flags
            </Eyebrow>
            <div className="mb-3.5 font-serif text-base font-semibold">Computed heuristics</div>
            <ul className="grid gap-2.5 text-[13px]">
              {trialToPaidPct > 0 && trialToPaidPct < 20 ? (
                <FlagItem
                  color="oxblood"
                  title={`Trial → paid sitting at ${trialToPaidPct}%`}
                  detail="Target is 25%. Inspect paywall skip reasons."
                />
              ) : null}
              {paywallSkipPct > 50 ? (
                <FlagItem
                  color="amber"
                  title={`Paywall skip rate ${paywallSkipPct}%`}
                  detail="Worth testing monthly-first default."
                />
              ) : null}
              {paid === 0 && signupTotal > 0 ? (
                <FlagItem
                  color="oxblood"
                  title="No paid conversions in range"
                  detail="Check whether STRIPE_PRICE_MAP is set."
                />
              ) : null}
              {signupTotal === 0 ? (
                <FlagItem
                  color="mute"
                  title="No signups in the last 30 days"
                  detail="Once the marketing surface gets traffic, KPIs will populate."
                />
              ) : null}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  note,
  good,
}: {
  label: string;
  value: string;
  note: string;
  good?: boolean;
}) {
  return (
    <div className="border border-rule bg-white p-[18px]">
      <Eyebrow className="mb-1.5 block">{label}</Eyebrow>
      <div className="font-serif font-mono text-[28px] font-semibold tabular-nums text-civic-navy">
        {value}
      </div>
      <div className={`mt-1 text-[11px] ${good ? "text-civic-green" : "text-mute"}`}>{note}</div>
    </div>
  );
}

function FlagItem({
  color,
  title,
  detail,
}: {
  color: "oxblood" | "amber" | "mute";
  title: string;
  detail: string;
}) {
  return (
    <li className="flex items-start gap-2.5 border border-rule-2 bg-paper p-3">
      <CivicBadge variant={color} solid dot>
        {" "}
      </CivicBadge>
      <div>
        <div className="text-[12.5px] font-semibold">{title}</div>
        <div className="mt-0.5 text-[11.5px] text-mute">{detail}</div>
      </div>
    </li>
  );
}
