"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { WizardShell } from "@/components/marketing/wizard-shell";
import { CivicField, CivicInput, CivicLabel } from "@/components/marketing/civic-input";
import { RadioCard } from "@/components/marketing/radio-card";

const ROLES: Array<{ value: string; title: string; description: string }> = [
  { value: "campaign_staff", title: "Campaign staff", description: "Working on a single race full-time." },
  {
    value: "consultant",
    title: "Political consultant",
    description: "Running multiple races for different candidates.",
  },
  { value: "party_staff", title: "Party / PAC staff", description: "Party committee or advocacy organization." },
  { value: "other", title: "Other", description: "Volunteer, academic, vendor, press." },
];

export default function WizardStepRole() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [role, setRole] = useState("consultant");

  function onContinue() {
    // TODO: persist name + role against the session user before advancing.
    router.push("/setup/campaign");
  }

  return (
    <WizardShell step={1} title="About you." onContinue={onContinue} continueDisabled={!name.trim()}>
      <CivicField>
        <CivicLabel htmlFor="name">Your name</CivicLabel>
        <CivicInput id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
      </CivicField>
      <CivicField>
        <CivicLabel>Your role</CivicLabel>
        <div className="grid gap-2">
          {ROLES.map((r) => (
            <RadioCard
              key={r.value}
              name="role"
              value={r.value}
              checked={role === r.value}
              onChange={setRole}
              title={r.title}
              description={r.description}
            />
          ))}
        </div>
      </CivicField>
      <div className="mt-1 border border-rule-2 bg-parchment p-3.5 text-[12.5px] text-mute">
        <span className="mr-1 align-[-2px] text-civic-navy">ℹ</span>
        Your role helps us show the right templates and examples. It&rsquo;s never shared.
      </div>
    </WizardShell>
  );
}
