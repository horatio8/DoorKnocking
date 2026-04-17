// Airtable Metadata API — read-only schema introspection. Requires the PAT to
// have the `schema.bases:read` scope on the target base.

import { airtableEnv } from "@/lib/env";

const META_BASE_URL = "https://api.airtable.com/v0/meta";

export interface AirtableField {
  id: string;
  name: string;
  type: string;
  options?: Record<string, unknown>;
}

export interface AirtableTable {
  id: string;
  name: string;
  primaryFieldId: string;
  fields: AirtableField[];
  recordCount?: number;
}

export interface AirtableBase {
  id: string;
  name: string;
  permissionLevel?: string;
}

async function fetchMeta<T>(path: string): Promise<T> {
  const env = airtableEnv();
  const res = await fetch(`${META_BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${env.apiKey}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Airtable metadata ${res.status}: ${text}`);
  }
  return (await res.json()) as T;
}

// List all bases the PAT can see. Useful for the picker UI.
export async function listBases(): Promise<AirtableBase[]> {
  const body = await fetchMeta<{ bases: AirtableBase[] }>("/bases");
  return body.bases;
}

// List tables + fields for a base.
export async function listTables(baseId: string): Promise<AirtableTable[]> {
  const body = await fetchMeta<{ tables: AirtableTable[] }>(`/bases/${baseId}/tables`);
  return body.tables;
}
