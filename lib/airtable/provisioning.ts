// Airtable metadata-API wrappers for *creating* bases, tables, and
// fields. The read-only side lives in `metadata.ts`; this module adds the
// write side we need to provision a canonical base from a client file.
//
// Requires the Airtable PAT / OAuth token to have
// `schema.bases:write` in addition to the existing scopes. Check
// `missingScopes()` in oauth.ts before calling from a user-facing path.
//
// Airtable's metadata API is stricter than the data API (5 req/s). We
// sleep 250ms between field creations to stay well under that cap.

import {
  CANONICAL_TABLES,
  type CanonicalField,
  type CanonicalTable,
  type CanonicalTableKey,
} from "./schema";

const META_BASE_URL = "https://api.airtable.com/v0/meta";
const FIELD_CREATE_DELAY_MS = 250;

async function postMeta<T>(token: string, path: string, body: unknown): Promise<T> {
  const res = await fetch(`${META_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Airtable metadata POST ${path} ${res.status}: ${text}`);
  }
  return (await res.json()) as T;
}

// ============================================================
// createBase — creates an empty base inside a workspace. Airtable
// insists on at least one table at creation, so we always seed it with
// the Voters table definition (minus linked fields); linked fields are
// added in pass 2 once all tables exist.
// ============================================================
export async function createBase(
  token: string,
  args: { workspaceId: string; name: string; seedTable: { name: string; fields: Array<{ name: string; type: string; options?: unknown; description?: string }> } },
): Promise<{ id: string; tables: Array<{ id: string; name: string; primaryFieldId: string; fields: Array<{ id: string; name: string; type: string }> }> }> {
  return postMeta(token, "/bases", {
    workspaceId: args.workspaceId,
    name: args.name,
    tables: [
      {
        name: args.seedTable.name,
        fields: args.seedTable.fields,
      },
    ],
  });
}

// ============================================================
// createTable — adds a table to an existing base. Again Airtable wants at
// least one field; we pass the table's primary field here and add the
// rest via createField afterwards.
// ============================================================
export async function createTable(
  token: string,
  baseId: string,
  args: { name: string; fields: Array<{ name: string; type: string; options?: unknown; description?: string }> },
): Promise<{ id: string; name: string; primaryFieldId: string; fields: Array<{ id: string; name: string }> }> {
  return postMeta(token, `/bases/${baseId}/tables`, args);
}

export async function createField(
  token: string,
  baseId: string,
  tableId: string,
  args: { name: string; type: string; options?: unknown; description?: string },
): Promise<{ id: string; name: string; type: string }> {
  return postMeta(token, `/bases/${baseId}/tables/${tableId}/fields`, args);
}

function toAirtableField(
  field: CanonicalField,
  tableIdsByKey: Partial<Record<CanonicalTableKey, string>>,
): { name: string; type: string; options?: unknown; description?: string } {
  const base: { name: string; type: string; options?: unknown; description?: string } = {
    name: field.name,
    type: field.type,
  };
  if (field.description) base.description = field.description;
  if (field.type === "singleSelect" && field.choices) {
    base.options = { choices: field.choices.map((c) => ({ name: c })) };
  }
  if (field.type === "multipleRecordLinks" && field.linkedTableKey) {
    const linkedTableId = tableIdsByKey[field.linkedTableKey];
    if (!linkedTableId) {
      throw new Error(`cannot build linked field ${field.name}: ${field.linkedTableKey} not provisioned yet`);
    }
    base.options = { linkedTableId };
  }
  if (field.type === "dateTime") {
    base.options = {
      dateFormat: { name: "iso" },
      timeFormat: { name: "24hour" },
      timeZone: "utc",
    };
  }
  return base;
}

// Split a table's fields into "primitives" (safe to create at table
// creation time) and "linked" (need a second pass once the target table
// exists). Linked fields are `multipleRecordLinks`.
function splitFields(table: CanonicalTable) {
  const primitive = table.fields.filter((f) => f.type !== "multipleRecordLinks");
  const linked = table.fields.filter((f) => f.type === "multipleRecordLinks");
  return { primitive, linked };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ============================================================
// provisionCanonicalBase — the top-level orchestrator.
//
// 1. createBase with the Voters table seeded with its primitive fields.
// 2. createTable for Households, Knocks, Conversations (primitive fields only).
// 3. Second pass: createField for every linked-record field across all
//    four tables, now that we know every target table's id.
// ============================================================
export interface ProvisionedBase {
  baseId: string;
  tableIdsByKey: Record<CanonicalTableKey, string>;
}

export async function provisionCanonicalBase(
  token: string,
  args: { workspaceId: string; name: string },
): Promise<ProvisionedBase> {
  const [voters, households, knocks, conversations] = CANONICAL_TABLES;
  const tableIdsByKey: Partial<Record<CanonicalTableKey, string>> = {};

  // Pass 1a: create the base seeded with Voters (primitive fields only).
  const votersPrim = splitFields(voters).primitive;
  const base = await createBase(token, {
    workspaceId: args.workspaceId,
    name: args.name,
    seedTable: {
      name: voters.name,
      fields: votersPrim.map((f) => toAirtableField(f, tableIdsByKey)),
    },
  });
  const baseId = base.id;
  const seededVoters = base.tables.find((t) => t.name === voters.name);
  if (!seededVoters) throw new Error("provision: base created but Voters table missing");
  tableIdsByKey.voters = seededVoters.id;

  // Pass 1b: create the other three tables (primitive fields only).
  for (const t of [households, knocks, conversations] as CanonicalTable[]) {
    const prim = splitFields(t).primitive;
    const created = await createTable(token, baseId, {
      name: t.name,
      fields: prim.map((f) => toAirtableField(f, tableIdsByKey)),
    });
    tableIdsByKey[t.key] = created.id;
    await sleep(FIELD_CREATE_DELAY_MS);
  }

  // Pass 2: add every linked-record field now that all table ids exist.
  for (const t of CANONICAL_TABLES) {
    const linked = splitFields(t).linked;
    for (const f of linked) {
      await createField(
        token,
        baseId,
        tableIdsByKey[t.key]!,
        toAirtableField(f, tableIdsByKey),
      );
      await sleep(FIELD_CREATE_DELAY_MS);
    }
  }

  return {
    baseId,
    tableIdsByKey: tableIdsByKey as Record<CanonicalTableKey, string>,
  };
}

// List the workspaces the current token can provision into. Needed for
// the first-run picker — legacy PAT clients don't have a stored
// `airtable_workspace_id`.
export async function listWorkspaces(
  token: string,
): Promise<Array<{ id: string; name: string }>> {
  const res = await fetch(`${META_BASE_URL}/workspaces`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Airtable workspaces ${res.status}: ${text}`);
  }
  const body = (await res.json()) as { workspaces?: Array<{ id: string; name: string }> };
  return body.workspaces ?? [];
}
