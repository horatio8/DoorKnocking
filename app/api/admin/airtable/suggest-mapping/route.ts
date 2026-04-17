import { NextResponse } from "next/server";
import { loadSession } from "@/lib/auth/session";
import { AirtableClient } from "@/lib/airtable/client";
import { listTables } from "@/lib/airtable/metadata";
import { proposeMapping } from "@/lib/airtable/proposer";

interface Body {
  baseId: string;
  tableId: string;
}

export async function POST(req: Request) {
  const session = await loadSession();
  if (!session || (session.user.role !== "admin" && session.user.role !== "super_admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  const { baseId, tableId } = body;
  if (!baseId || !tableId) {
    return NextResponse.json({ error: "baseId and tableId required" }, { status: 400 });
  }

  try {
    const tables = await listTables(baseId);
    const table = tables.find((t) => t.id === tableId);
    if (!table) {
      return NextResponse.json({ error: "table not found in base" }, { status: 404 });
    }

    const airtable = new AirtableClient();
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
