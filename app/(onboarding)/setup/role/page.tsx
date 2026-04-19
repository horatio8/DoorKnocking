"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { WizardShell } from "@/components/marketing/wizard-shell";
import { CivicField, CivicInput, CivicLabel } from "@/components/marketing/civic-input";
import { RadioCard } from "@/components/marketing/radio-card";
import { trackFunnel } from "@/lib/marketing/funnel";

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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    trackFunnel("wizard_step_1");
  }, []);

  async function onContinue() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding/wizard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: 1, payload: { name, role } }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? `${res.status}`);
      router.push("/setup/campaign");
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <WizardShell
      step={1}
      title="About you."
      onContinue={onContinue}
      continueDisabled={busy || !name.trim()}
    >
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
      {error ? (
        <p className="mt-3 rounded-sm bg-oxblood/10 px-3 py-2 text-xs text-oxblood">{error}</p>
      ) : null}
    </WizardShell>
  );
}
