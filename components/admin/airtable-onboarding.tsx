"use client";

import { useState } from "react";
import type { FieldMapping } from "@/lib/airtable/mapping";
import { AirtableConnectionWizard } from "./airtable-wizard";
import { AirtableFileUploadWizard } from "./file-upload-wizard";

// Tab-switcher wrapper that lets the admin pick between the new upload
// path (file → blank Airtable → app) and the legacy "connect my base"
// path. Defaults to Upload for unconfigured districts; lands on Connect
// if the district already has a mapping stored.

interface Props {
  districtId: string;
  districtName: string;
  initialBaseId: string;
  initialTableId: string;
  initialMapping: FieldMapping | null;
  hasCanonicalBase: boolean;
  status: string;
  lastImportedAt: string | null;
  lastError: string | null;
  lastSummary: Record<string, unknown> | null;
  lastRelative: string;
}

type Tab = "upload" | "connect";

export function AirtableOnboarding(props: Props) {
  const [tab, setTab] = useState<Tab>(props.initialMapping ? "connect" : "upload");

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-lg border border-border bg-white p-1 text-sm">
        <TabButton active={tab === "upload"} onClick={() => setTab("upload")}>
          Upload a file
        </TabButton>
        <TabButton active={tab === "connect"} onClick={() => setTab("connect")}>
          Connect existing base
        </TabButton>
      </div>
      {tab === "upload" ? (
        <AirtableFileUploadWizard
          districtId={props.districtId}
          districtName={props.districtName}
          hasCanonicalBase={props.hasCanonicalBase}
        />
      ) : (
        <AirtableConnectionWizard
          districtId={props.districtId}
          districtName={props.districtName}
          initialBaseId={props.initialBaseId}
          initialTableId={props.initialTableId}
          initialMapping={props.initialMapping}
          status={props.status}
          lastImportedAt={props.lastImportedAt}
          lastError={props.lastError}
          lastSummary={props.lastSummary}
          lastRelative={props.lastRelative}
        />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick(): void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-4 py-1.5 text-sm transition ${
        active ? "bg-navy text-white" : "text-navy-700 hover:bg-navy-50"
      }`}
    >
      {children}
    </button>
  );
}
