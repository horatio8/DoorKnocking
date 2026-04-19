import type { Metadata } from "next";
import { CivicAdminShell } from "@/components/marketing/civic-admin-shell";
import { CivicButton } from "@/components/marketing/civic-button";
import { CivicBadge } from "@/components/marketing/civic-badge";
import { Eyebrow } from "@/components/marketing/eyebrow";

export const metadata: Metadata = { title: "Trial ended — Campaign OS" };

// 12 · Trial-ended state. Oxblood banner across the top, voter table renders
// at opacity-75 with party badges.

const ROWS: Array<[string, string, "R" | "D" | "I", string, string]> = [
  ["Ashford, Margaret H.", "127 Queen St, Charleston", "R", "Turf 3 — North", "—"],
  ["Beauchamp, Everett L.", "219 Meeting St, Charleston", "I", "Turf 3 — North", "Apr 11"],
  ["Crawford, Henrietta", "44 Broad St, Charleston", "D", "Turf 1 — Waterfront", "—"],
  ["Dennison, Robert W. III", "2 King St, Charleston", "R", "Turf 1 — Waterfront", "Apr 09"],
  ["Ellington, Margaret", "81 Tradd St, Charleston", "R", "Turf 2 — Historic", "—"],
];

function TrialEndedBanner() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-oxblood-2 bg-oxblood px-6 py-2.5 text-sm text-parchment">
      <div className="flex items-center gap-2.5">
        <WarnIcon className="h-4 w-4 text-parchment" />
        <span>
          <strong>Your trial has ended.</strong> Your account is in read-only mode. Add a card to
          continue canvassing, or export your data within the next{" "}
          <span className="font-mono tabular-nums">27 days</span>.
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        <CivicButton variant="primary" size="sm" className="border-parchment bg-parchment text-oxblood hover:bg-parchment hover:text-oxblood-2">
          Add a card
        </CivicButton>
        <CivicButton variant="ghost" size="sm" className="border-parchment/40 text-parchment hover:border-parchment hover:bg-transparent hover:text-parchment">
          Export data
        </CivicButton>
      </div>
    </div>
  );
}

export default function TrialEndedView() {
  return (
    <CivicAdminShell active="Voters" banner={<TrialEndedBanner />} planBadge="TRIAL · ENDED">
      <div className="mb-5">
        <Eyebrow variant="oxblood" className="mb-1 block">
          Read-only mode
        </Eyebrow>
        <h2 className="font-serif text-[28px] font-semibold leading-[1.1] tracking-[-0.01em] text-civic-navy">
          Voter roll ·{" "}
          <span className="font-normal font-mono tabular-nums text-mute">94 voters</span>
        </h2>
      </div>
      <div className="mb-4 flex items-start gap-3 border border-rule bg-parchment p-4 text-[13.5px] text-ink-2">
        <LockIcon className="mt-0.5 h-4 w-4 flex-none text-oxblood" />
        <div>
          <strong>What&rsquo;s locked:</strong> new imports, walkbook generation, knock sessions,
          new volunteer invites, Airtable sync writes.
          <br />
          <strong>What&rsquo;s still live:</strong> viewing data, exporting CSVs, billing changes,
          support chat.
        </div>
      </div>
      <table className="w-full border border-rule bg-white text-left text-sm">
        <thead className="bg-parchment">
          <tr className="text-[11px] uppercase tracking-[0.08em] text-mute">
            <th className="px-5 py-3 font-semibold">Name</th>
            <th className="px-3 py-3 font-semibold">Address</th>
            <th className="px-3 py-3 font-semibold">Party</th>
            <th className="px-3 py-3 font-semibold">Turf</th>
            <th className="px-3 py-3 font-semibold">Last knock</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((r) => (
            <tr key={r[0]} className="border-t border-rule-2 opacity-75">
              <td className="px-5 py-3 font-serif font-semibold">{r[0]}</td>
              <td className="px-3 py-3 font-mono text-xs tabular-nums">{r[1]}</td>
              <td className="px-3 py-3">
                <CivicBadge variant={r[2] === "R" ? "oxblood" : r[2] === "D" ? "navy" : "mute"}>
                  {r[2]}
                </CivicBadge>
              </td>
              <td className="px-3 py-3 text-xs">{r[3]}</td>
              <td className="px-3 py-3 font-mono text-xs tabular-nums text-mute">{r[4]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </CivicAdminShell>
  );
}

function WarnIcon(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.3} aria-hidden {...p}>
      <path d="M8 2l6.5 11.5h-13z" />
      <path d="M8 6.5v3.5M8 11.8v.2" />
    </svg>
  );
}

function LockIcon(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.3} aria-hidden {...p}>
      <rect x="3" y="7" width="10" height="7" rx="0.5" />
      <path d="M5 7V5a3 3 0 016 0v2" />
    </svg>
  );
}
