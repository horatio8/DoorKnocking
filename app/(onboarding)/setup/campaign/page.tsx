"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { WizardShell } from "@/components/marketing/wizard-shell";
import { CivicField, CivicInput, CivicLabel } from "@/components/marketing/civic-input";
import { cn } from "@/lib/utils";

const ELECTION_TYPES = [
  { value: "primary", label: "Primary" },
  { value: "general", label: "General" },
  { value: "advocacy", label: "Advocacy / PAC" },
];

const TRAVEL_MODES = [
  { value: "walking", title: "Walking", description: "Dense urban routes" },
  { value: "driving", title: "Driving", description: "Rural & suburban" },
];

export default function WizardStepCampaign() {
  const router = useRouter();
  const [campaign, setCampaign] = useState("Sprouse for SC House 115");
  const [candidate, setCandidate] = useState("James Sprouse");
  const [electionType, setElectionType] = useState("general");
  const [travel, setTravel] = useState("driving");

  function onContinue() {
    router.push("/setup/district");
  }

  return (
    <WizardShell
      step={2}
      title="Your first campaign."
      backHref="/setup/role"
      onContinue={onContinue}
      continueDisabled={!campaign.trim()}
    >
      <CivicField>
        <CivicLabel htmlFor="campaign">Campaign or organization name</CivicLabel>
        <CivicInput
          id="campaign"
          value={campaign}
          onChange={(e) => setCampaign(e.target.value)}
        />
      </CivicField>

      <CivicField>
        <CivicLabel htmlFor="candidate" hint="if applicable">
          Candidate
        </CivicLabel>
        <CivicInput
          id="candidate"
          value={candidate}
          onChange={(e) => setCandidate(e.target.value)}
        />
      </CivicField>

      <CivicField>
        <CivicLabel>Election type</CivicLabel>
        <div className="grid grid-cols-3 gap-2">
          {ELECTION_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setElectionType(t.value)}
              className={cn(
                "border px-3 py-3 font-sans text-sm font-medium",
                electionType === t.value
                  ? "border-civic-navy bg-civic-navy text-parchment"
                  : "border-rule bg-white text-ink hover:border-civic-navy/40",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </CivicField>

      <CivicField>
        <CivicLabel>Default travel mode</CivicLabel>
        <div className="grid grid-cols-2 gap-2">
          {TRAVEL_MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setTravel(m.value)}
              className={cn(
                "border px-4 py-3.5 text-left",
                travel === m.value
                  ? "border-civic-navy bg-parchment"
                  : "border-rule bg-white hover:border-civic-navy/40",
              )}
            >
              <div className="text-sm font-semibold text-ink">{m.title}</div>
              <div className="mt-0.5 text-xs text-mute">{m.description}</div>
            </button>
          ))}
        </div>
      </CivicField>
    </WizardShell>
  );
}
