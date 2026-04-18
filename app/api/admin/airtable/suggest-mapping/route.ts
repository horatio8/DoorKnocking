import { NextResponse } from "next/server";
import { loadSession } from "@/lib/auth/session";
import { getActiveClient } from "@/lib/clients/active";
import { AirtableClient } from "@/lib/airtable/client";
import { listTables } from "@/lib/airtable/metadata";
import { proposeMapping } from "@/lib/airtable/proposer";
import {
  resolveAirtableToken,
  resolveAirtableTokenForDistrict,
} from "@/lib/airtable/credentials";

interface Body {
  baseId: string;
  tableId: string;
  districtId?: string;
}

export async function POST(req: Request) {
  const session = await loadSession();
  if (!session || (session.user.role !== "admin" && session.user.role !== "super_admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  const { baseId, tableId, districtId } = body;
  if (!baseId || !tableId) {
    return NextResponse.json({ error: "baseId and tableId required" }, { status: 400 });
  }

  const creds = districtId
    ? await resolveAirtableTokenForDistrict(districtId)
    : await resolveAirtableToken((await getActiveClient())?.id ?? null);
  if (!creds) {
    return NextResponse.json(
      { error: "No Airtable token configured for this client. Go to Settings → Airtable." },
      { status: 412 },
    );
  }

  try {
    const tables = await listTables(creds.token, baseId);
    const table = tables.find((t) => t.id === tableId);
    if (!table) {
      return NextResponse.json({ error: "table not found in base" }, { status: 404 });
    }

    const airtable = new AirtableClient(creds.token);
    const samples = [];
    for await (const rec of airtable.listAll<{ id: string; fields: Record<string, unknown> }>(
      baseId,
      tableId,
      { pageSize: 10 },
    )) {
      samples.push(rec);
      if (samples.length >= 10) break;
    }

    const proposal = await proposeMapping({
      airtableTableName: table.name,
      airtableFields: table.fields,
      sampleRows: samples,
    });

    return NextResponse.json({
      table: { id: table.id, name: table.name, fields: table.fields },
      sample_count: samples.length,
      proposal,
    });
  } catch (err) {
    console.error("suggest-mapping:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
