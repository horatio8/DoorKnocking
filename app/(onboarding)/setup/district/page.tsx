"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { WizardShell } from "@/components/marketing/wizard-shell";
import {
  CivicField,
  CivicInput,
  CivicLabel,
  CivicSelect,
} from "@/components/marketing/civic-input";
import { RadioCard } from "@/components/marketing/radio-card";
import { Eyebrow } from "@/components/marketing/eyebrow";

export default function WizardStepDistrict() {
  const router = useRouter();
  const [country, setCountry] = useState("United States");
  const [region, setRegion] = useState("South Carolina");
  const [districtName, setDistrictName] = useState("SC House District 115");
  const [targetVoters, setTargetVoters] = useState("460");
  const [airtable, setAirtable] = useState<"byo" | "managed">("byo");
  const [baseId, setBaseId] = useState("appz0KOPIaQFCxxw3");

  function onContinue() {
    // TODO: create the first client + district row, link Airtable if 'byo'.
    // For now, bounce to the admin dashboard which handles empty-state.
    router.push("/admin");
  }

  return (
    <WizardShell
      step={3}
      title="Your first district."
      backHref="/setup/campaign"
      onContinue={onContinue}
      continueLabel="Finish setup"
      continueDisabled={!districtName.trim()}
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <CivicField>
          <CivicLabel htmlFor="country">Country</CivicLabel>
          <CivicSelect
            id="country"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
          >
            <option>United States</option>
            <option>Australia</option>
            <option>Canada</option>
          </CivicSelect>
        </CivicField>
        <CivicField>
          <CivicLabel htmlFor="region">State / Region</CivicLabel>
          <CivicSelect
            id="region"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
          >
            <option>South Carolina</option>
            <option>North Carolina</option>
            <option>Georgia</option>
            <option>Virginia</option>
          </CivicSelect>
        </CivicField>
      </div>

      <CivicField>
        <CivicLabel htmlFor="district">District name</CivicLabel>
        <CivicInput
          id="district"
          value={districtName}
          onChange={(e) => setDistrictName(e.target.value)}
        />
      </CivicField>

      <CivicField>
        <CivicLabel htmlFor="target" hint="approximate">
          Target voter count
        </CivicLabel>
        <CivicInput
          id="target"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={targetVoters}
          onChange={(e) => setTargetVoters(e.target.value.replace(/[^0-9]/g, ""))}
          className="max-w-[160px] font-mono tabular-nums"
        />
        <p className="mt-1.5 text-xs text-mute">
          We use this to suggest the right plan tier at checkout.
        </p>
      </CivicField>

      <hr className="my-6 border-0 border-t border-rule" />

      <Eyebrow className="mb-3 block">Airtable integration</Eyebrow>
      <div className="grid gap-2.5">
        <RadioCard
          name="airtable"
          value="byo"
          checked={airtable === "byo"}
          onChange={() => setAirtable("byo")}
          title="Connect my own Airtable base"
          description="Recommended. Full ownership of your data."
        >
          {airtable === "byo" ? (
            <CivicInput
              value={baseId}
              onChange={(e) => setBaseId(e.target.value)}
              className="mt-2 font-mono tabular-nums"
              placeholder="appXXXXXXXXXXXXX"
            />
          ) : null}
        </RadioCard>
        <RadioCard
          name="airtable"
          value="managed"
          checked={airtable === "managed"}
          onChange={() => setAirtable("managed")}
          title={
            <>
              We&rsquo;ll store your data
              <span className="ml-1.5 inline-flex items-center rounded-sm border border-rule px-1.5 py-[1px] text-[9px] font-semibold uppercase tracking-[0.14em] text-mute">
                Default
              </span>
            </>
          }
          description="Skip Airtable — use our in-app reporting. You can connect later."
        />
      </div>
    </WizardShell>
  );
}
