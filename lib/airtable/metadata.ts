// Airtable Metadata API — read-only schema introspection. Requires the PAT to
// have the `schema.bases:read` scope on the target base.

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

async function fetchMeta<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`${META_BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
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
export async function listBases(token: string): Promise<AirtableBase[]> {
  const body = await fetchMeta<{ bases: AirtableBase[] }>(token, "/bases");
  return body.bases;
}

// List tables + fields for a base.
export async function listTables(token: string, baseId: string): Promise<AirtableTable[]> {
  const body = await fetchMeta<{ tables: AirtableTable[] }>(token, `/bases/${baseId}/tables`);
  return body.tables;
}

// Whoami-style check — Airtable doesn't have a /whoami, but /meta/bases is a
// cheap privileged call that validates the token + scopes in one go.
export async function verifyToken(token: string): Promise<{ ok: true; base_count: number } | { ok: false; error: string }> {
  try {
    const body = await fetchMeta<{ bases: AirtableBase[] }>(token, "/bases");
    return { ok: true, base_count: body.bases.length };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
