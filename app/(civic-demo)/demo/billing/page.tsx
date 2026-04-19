import type { Metadata } from "next";
import { CivicAdminShell } from "@/components/marketing/civic-admin-shell";
import { CivicButton } from "@/components/marketing/civic-button";
import { CivicBadge } from "@/components/marketing/civic-badge";
import { Eyebrow } from "@/components/marketing/eyebrow";

export const metadata: Metadata = { title: "Billing — Campaign OS" };

// 11 · Billing management — current plan card + payment method + usage
// meters + invoices table. Civic aesthetic per handoff README §11.

const METERS: Array<{ label: string; n: number; cap: number; unit?: string }> = [
  { label: "Doors imported", n: 6480, cap: 10000 },
  { label: "Active volunteers", n: 14, cap: 20 },
  { label: "Voice minutes", n: 812.4, cap: 1000, unit: "min" },
  { label: "AI calls", n: 2410, cap: 10000 },
];

const INVOICES: Array<[string, string, string, string, "paid"]> = [
  ["INV-0043", "May 3, 2026", "Pro · Annual", "$1,990.00", "paid"],
  ["INV-0042", "May 3, 2026", "Trial started", "$0.00", "paid"],
];

export default function BillingDemo() {
  return (
    <CivicAdminShell active="Billing" planBadge="PRO · ACTIVE">
      <div className="mb-6">
        <Eyebrow className="mb-1 block">Settings</Eyebrow>
        <h2 className="font-serif text-[28px] font-semibold leading-[1.1] tracking-[-0.01em] text-civic-navy">
          Billing &amp; Plan
        </h2>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-[1.4fr_1fr]">
        {/* Current plan */}
        <div className="border border-rule bg-white p-6">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <Eyebrow variant="oxblood" className="mb-1.5 block">
                Current plan
              </Eyebrow>
              <div className="font-serif text-[26px] font-semibold leading-[1.1] tracking-[-0.01em] text-civic-navy">
                Pro — Annual
              </div>
              <p className="mt-0.5 text-[13px] text-mute">
                Sprouse for SC 115 · client subscription
              </p>
            </div>
            <CivicBadge variant="green" solid dot>
              Active
            </CivicBadge>
          </div>
          <div className="grid grid-cols-3 gap-5 border-y border-rule-2 py-4">
            <div>
              <Eyebrow className="mb-1 block">Price</Eyebrow>
              <div className="font-mono text-lg font-semibold tabular-nums text-civic-navy">
                $1,990
                <span className="text-xs font-normal text-mute">/yr</span>
              </div>
            </div>
            <div>
              <Eyebrow className="mb-1 block">Next charge</Eyebrow>
              <div className="font-mono text-sm font-semibold tabular-nums">May 3, 2027</div>
            </div>
            <div>
              <Eyebrow className="mb-1 block">Started</Eyebrow>
              <div className="font-mono text-sm font-semibold tabular-nums">May 3, 2026</div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <CivicButton variant="primary" size="sm">
              Change plan
            </CivicButton>
            <CivicButton variant="ghost" size="sm">
              Open Stripe portal ↗
            </CivicButton>
            <button
              type="button"
              className="ml-auto text-xs text-mute underline underline-offset-[3px] hover:text-oxblood"
            >
              Cancel subscription
            </button>
          </div>
        </div>

        {/* Payment method */}
        <div className="border border-rule bg-white p-6">
          <Eyebrow variant="oxblood" className="mb-1.5 block">
            Payment method
          </Eyebrow>
          <div className="flex items-center gap-3.5 py-3.5">
            <div className="flex h-7 w-11 items-center justify-center border border-rule text-[10px] font-bold tracking-[0.1em] text-civic-navy">
              VISA
            </div>
            <div>
              <div className="font-mono text-sm font-medium tabular-nums">
                •••• •••• •••• 4242
              </div>
              <div className="text-[11px] text-mute">Expires 05/29 · James E. Sprouse</div>
            </div>
          </div>
          <CivicButton variant="ghost" size="sm" className="w-full">
            Update payment method
          </CivicButton>
          <hr className="my-4 border-0 border-t border-rule" />
          <Eyebrow className="mb-1.5 block">Billing email</Eyebrow>
          <div className="font-mono text-[13px]">james@teller.co</div>
        </div>
      </div>

      {/* Usage */}
      <div className="mb-5 border border-rule bg-white p-6">
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <div>
            <Eyebrow variant="oxblood">Usage this period</Eyebrow>
            <div className="mt-1 font-serif text-lg font-semibold text-civic-navy">
              May 3 – June 3, 2026
            </div>
          </div>
          <CivicButton variant="ghost" size="sm">
            View full history →
          </CivicButton>
        </div>
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {METERS.map((m) => {
            const p = Math.min(100, (m.n / m.cap) * 100);
            const warn = p > 80;
            return (
              <div key={m.label}>
                <Eyebrow className="mb-1.5 block">{m.label}</Eyebrow>
                <div
                  className={`font-mono text-[22px] font-semibold tabular-nums ${warn ? "text-oxblood" : "text-civic-navy"}`}
                >
                  {m.n.toLocaleString()}
                  <span className="text-xs font-normal text-mute">
                    {" "}
                    / {m.cap.toLocaleString()}
                    {m.unit ? ` ${m.unit}` : ""}
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden bg-rule-2">
                  <div
                    className={`h-full ${warn ? "bg-oxblood" : "bg-civic-navy"}`}
                    style={{ width: `${p}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Invoices */}
      <div className="border border-rule bg-white">
        <div className="flex items-center justify-between border-b border-rule-2 px-6 py-5">
          <div>
            <Eyebrow variant="oxblood">Invoices</Eyebrow>
            <div className="mt-1 font-serif text-lg font-semibold">Billing history</div>
          </div>
          <CivicButton variant="ghost" size="sm">
            Open in Stripe ↗
          </CivicButton>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="bg-parchment">
            <tr className="text-[11px] uppercase tracking-[0.08em] text-mute">
              <th className="px-6 py-3 font-semibold">Invoice</th>
              <th className="px-3 py-3 font-semibold">Date</th>
              <th className="px-3 py-3 font-semibold">Description</th>
              <th className="px-3 py-3 font-semibold">Amount</th>
              <th className="px-3 py-3 font-semibold">Status</th>
              <th className="px-6 py-3 font-semibold"></th>
            </tr>
          </thead>
          <tbody>
            {INVOICES.map((row) => (
              <tr key={row[0]} className="border-t border-rule-2">
                <td className="px-6 py-3 font-mono tabular-nums">{row[0]}</td>
                <td className="px-3 py-3">{row[1]}</td>
                <td className="px-3 py-3">{row[2]}</td>
                <td className="px-3 py-3 font-mono font-semibold tabular-nums">{row[3]}</td>
                <td className="px-3 py-3">
                  <CivicBadge variant="green" solid dot>
                    {row[4]}
                  </CivicBadge>
                </td>
                <td className="px-6 py-3 text-right">
                  <a
                    href="#"
                    className="text-xs text-civic-navy underline underline-offset-[3px] hover:text-oxblood"
                  >
                    ↓ PDF
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </CivicAdminShell>
  );
}
