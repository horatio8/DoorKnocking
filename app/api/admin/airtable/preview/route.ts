import { NextResponse } from "next/server";
import { loadSession } from "@/lib/auth/session";
import { AirtableClient } from "@/lib/airtable/client";
import { mapRecord } from "@/lib/airtable/import";
import type { FieldMapping } from "@/lib/airtable/mapping";

interface Body {
  baseId: string;
  tableId: string;
  mapping: FieldMapping;
  limit?: number;
}

export async function POST(req: Request) {
  const session = await loadSession();
  if (!session || (session.user.role !== "admin" && session.user.role !== "super_admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  const { baseId, tableId, mapping, limit = 5 } = body;
  if (!baseId || !tableId || !mapping) {
    return NextResponse.json({ error: "baseId, tableId, mapping required" }, { status: 400 });
  }

  try {
    const airtable = new AirtableClient();
    const out: unknown[] = [];
    for await (const rec of airtable.listAll<{ id: string; fields: Record<string, unknown> }>(
      baseId,
      tableId,
      { pageSize: 10 },
    )) {
      const mapped = mapRecord(rec.fields ?? {}, mapping, rec.id);
      out.push({
        airtable_id: rec.id,
        voter: mapped.voter,
        household: mapped.household,
      });
      if (out.length >= limit) break;
    }
    return NextResponse.json({ rows: out });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
