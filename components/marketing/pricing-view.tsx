"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { CivicButton } from "./civic-button";
import { Eyebrow } from "./eyebrow";
import {
  FEATURE_MATRIX,
  PLANS,
  TRUST_STATS,
  type Plan,
} from "@/lib/marketing/pricing-data";
import { ArrowIcon, CheckIcon, ShieldIcon, XIcon } from "./civic-icons";
import { trackFunnel } from "@/lib/marketing/funnel";

type Interval = "monthly" | "annual";

// Implements design_handoff_onboarding_flow/pricing.jsx — hero, three plan
// cards with interval toggle, feature matrix, navy trust strip.
export function PricingView() {
  const [interval, setInterval] = useState<Interval>("annual");

  useEffect(() => {
    trackFunnel("pricing_viewed");
  }, []);

  return (
    <div className="bg-paper">
      {/* ───────── Hero ───────── */}
      <section className="border-b border-rule bg-parchment px-8 py-[72px]">
        <div className="mx-auto max-w-[1000px] text-center">
          <Eyebrow variant="oxblood" className="mb-3.5 block">
            ★&nbsp;&nbsp;&nbsp;Pricing&nbsp;&nbsp;&nbsp;★
          </Eyebrow>
          <h1 className="font-serif text-[52px] font-semibold leading-[1.05] tracking-[-0.02em] text-civic-navy [text-wrap:balance]">
            Honest pricing for{" "}
            <em className="font-serif italic text-oxblood">serious campaigns.</em>
          </h1>
          <p className="mx-auto mt-4 max-w-[560px] text-[17px] leading-[1.5] text-ink-2">
            Fourteen days free. No credit card until the last day of your trial. Cancel with one
            click.
          </p>

          {/* Interval toggle */}
          <div className="mt-7 inline-flex border border-rule bg-white p-[3px]">
            {(["monthly", "annual"] as Interval[]).map((v) => {
              const active = interval === v;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => setInterval(v)}
                  className={cn(
                    "px-5 py-[9px] font-sans text-[13px] font-semibold uppercase tracking-[0.04em]",
                    active ? "bg-civic-navy text-parchment" : "bg-transparent text-ink-2",
                  )}
                >
                  {v === "monthly" ? "Monthly" : "Annual"}
                  {v === "annual" ? (
                    <span
                      className={cn(
                        "ml-2 text-[10px]",
                        active ? "text-parchment" : "text-oxblood",
                      )}
                    >
                      − 17%
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ───────── Plan cards ───────── */}
      <section className="bg-paper px-8 py-12">
        <div className="mx-auto grid max-w-[1120px] gap-5 md:grid-cols-3">
          {PLANS.map((plan) => (
            <PricingCard key={plan.tier} plan={plan} interval={interval} />
          ))}
        </div>
        <p className="mx-auto mt-6 max-w-[1120px] text-center text-[13px] text-mute">
          <ShieldIcon className="-mb-0.5 mr-1 inline h-4 w-4 text-civic-navy" /> Stripe-secured ·
          PCI-DSS compliant · Data stored in US-East facilities
        </p>
      </section>

      {/* ───────── Feature matrix ───────── */}
      <section className="border-t border-rule bg-parchment px-8 pb-[72px] pt-12">
        <div className="mx-auto max-w-[1120px]">
          <div className="mb-8 text-center">
            <Eyebrow className="mb-2 block">Compare plans</Eyebrow>
            <h2 className="font-serif text-[32px] font-semibold leading-[1.1] text-civic-navy">
              Every feature, on the table.
            </h2>
          </div>
          <div className="border border-rule bg-white">
            <table className="w-full border-collapse text-left text-[13.5px]">
              <thead>
                <tr>
                  <th className="w-[40%] bg-parchment-2 px-5 py-4 font-sans text-[11px] font-semibold uppercase tracking-[0.08em] text-mute">
                    Feature
                  </th>
                  <th className="bg-parchment-2 px-5 py-4 text-center font-sans text-[11px] font-semibold uppercase tracking-[0.08em] text-mute">
                    Starter
                  </th>
                  <th className="border-b border-civic-navy bg-civic-navy px-5 py-4 text-center font-sans text-[11px] font-semibold uppercase tracking-[0.08em] text-parchment">
                    Pro
                  </th>
                  <th className="bg-parchment-2 px-5 py-4 text-center font-sans text-[11px] font-semibold uppercase tracking-[0.08em] text-mute">
                    Agency
                  </th>
                </tr>
              </thead>
              <tbody>
                {FEATURE_MATRIX.map((g) => (
                  <FeatureGroup key={g.group} group={g.group} rows={g.rows} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ───────── Trust strip ───────── */}
      <section className="bg-civic-navy px-8 py-12 text-parchment">
        <div className="mx-auto grid max-w-[1000px] gap-8 text-center md:grid-cols-4">
          {TRUST_STATS.map((s) => (
            <div key={s.l}>
              <div className="mb-1.5 font-serif font-mono text-[36px] font-medium tabular-nums text-parchment">
                {s.n}
              </div>
              <Eyebrow variant="on-navy">{s.l}</Eyebrow>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function PricingCard({ plan, interval }: { plan: Plan; interval: Interval }) {
  const recommended = Boolean(plan.recommended);
  const price =
    plan.custom || plan.annual == null || plan.monthly == null
      ? null
      : interval === "annual"
        ? Math.round(plan.annual / 12)
        : plan.monthly;

  return (
    <div
      className={cn(
        "relative flex min-h-[520px] flex-col border p-7",
        recommended
          ? "border-civic-navy bg-civic-navy text-parchment"
          : "border-rule bg-white text-ink",
      )}
    >
      {recommended ? (
        <div className="absolute -top-3 left-6 bg-oxblood px-2.5 py-1 font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-parchment">
          ★ Most chosen
        </div>
      ) : null}

      <div className="mb-1 flex items-baseline justify-between">
        <h3
          className={cn(
            "font-serif text-[24px] font-semibold leading-[1.25]",
            recommended ? "text-parchment" : "text-civic-navy",
          )}
        >
          {plan.name}
        </h3>
        <Eyebrow variant={recommended ? "on-navy" : "default"}>{plan.numeral}</Eyebrow>
      </div>
      <p
        className={cn(
          "mb-5 font-serif text-sm italic",
          recommended ? "text-parchment/70" : "text-mute",
        )}
      >
        {plan.pitchLine}
      </p>

      <div
        className={cn(
          "mb-5 border-b pb-5",
          recommended ? "border-parchment/15" : "border-rule-2",
        )}
      >
        {plan.custom ? (
          <div className="font-serif text-[40px] font-medium leading-none">Custom</div>
        ) : (
          <>
            <div className="flex items-baseline gap-1.5">
              <span className="font-mono text-[44px] font-medium leading-none tracking-[-0.02em] tabular-nums">
                ${price}
              </span>
              <span
                className={cn(
                  "text-sm",
                  recommended ? "text-parchment/60" : "text-mute",
                )}
              >
                /month
              </span>
            </div>
            <div
              className={cn(
                "mt-1.5 text-xs",
                recommended ? "text-parchment/60" : "text-mute",
              )}
            >
              {interval === "annual" ? (
                <>
                  ${plan.annual} billed annually ·{" "}
                  <span
                    className={cn(
                      "font-semibold",
                      recommended ? "text-parchment" : "text-oxblood",
                    )}
                  >
                    save 17%
                  </span>
                </>
              ) : (
                <>Billed monthly · cancel any time</>
              )}
            </div>
          </>
        )}
      </div>

      <ul className="mb-6 flex flex-1 flex-col gap-2.5">
        {plan.features.map((f, i) => (
          <li
            key={i}
            className={cn(
              "flex items-start gap-2.5 text-[13.5px] leading-[1.4]",
              !f.included && "opacity-45",
            )}
          >
            {f.included ? (
              <CheckIcon
                className={cn(
                  "mt-0.5 h-4 w-4 flex-none",
                  recommended ? "text-parchment" : "text-oxblood",
                )}
              />
            ) : (
              <XIcon
                className={cn(
                  "mt-0.5 h-4 w-4 flex-none",
                  recommended ? "text-parchment/40" : "text-mute-2",
                )}
              />
            )}
            <span>{f.text}</span>
          </li>
        ))}
      </ul>

      <CivicButton
        as="link"
        href={plan.custom ? "/contact-sales" : `/signup?plan=${plan.tier}`}
        variant={recommended ? "oxblood" : plan.custom ? "ghost" : "primary"}
        size="lg"
        className="w-full"
      >
        {plan.cta} <ArrowIcon className="h-4 w-4" />
      </CivicButton>
    </div>
  );
}

function FeatureGroup({
  group,
  rows,
}: {
  group: string;
  rows: Array<[string, boolean | string, boolean | string, boolean | string]>;
}) {
  return (
    <>
      <tr>
        <td
          colSpan={4}
          className="border-b border-rule bg-paper px-5 pb-1.5 pt-3.5 font-serif text-[15px] font-semibold text-oxblood"
        >
          {group}
        </td>
      </tr>
      {rows.map((row, i) => {
        const [label, starter, pro, agency] = row;
        return (
          <tr key={`${group}-${i}`} className="border-b border-rule-2 last:border-b-0">
            <td className="px-5 py-3 text-sm text-ink-2">{label}</td>
            <MatrixCell value={starter} />
            <MatrixCell value={pro} highlighted />
            <MatrixCell value={agency} />
          </tr>
        );
      })}
    </>
  );
}

function MatrixCell({
  value,
  highlighted,
}: {
  value: boolean | string;
  highlighted?: boolean;
}) {
  return (
    <td
      className={cn(
        "px-5 py-3 text-center text-[13px]",
        highlighted && "bg-civic-navy/[0.03]",
      )}
    >
      {value === true ? (
        <CheckIcon className="mx-auto h-4 w-4 text-oxblood" />
      ) : value === false ? (
        <span className="text-mute-2">—</span>
      ) : (
        <span
          className={cn(
            "text-ink-2",
            typeof value === "string" && /\d/.test(value) && "font-mono tabular-nums",
          )}
        >
          {value}
        </span>
      )}
    </td>
  );
}

// Tiny Link re-export so page.tsx stays tidy — the masthead/footer imports
// `next/link` directly.
export { Link };
