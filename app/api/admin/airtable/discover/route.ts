import { NextResponse } from "next/server";
import { loadSession } from "@/lib/auth/session";
import { getActiveClient } from "@/lib/clients/active";
import { listBases, listTables } from "@/lib/airtable/metadata";
import {
  resolveAirtableToken,
  resolveAirtableTokenForDistrict,
} from "@/lib/airtable/credentials";

// GET /api/admin/airtable/discover            -> { bases }
// GET /api/admin/airtable/discover?baseId=app -> { tables }
// Optional ?districtId=... — preferred when onboarding from the apex host
// (no client subdomain), so we resolve the PAT by district ownership.
export async function GET(req: Request) {
  const session = await loadSession();
  if (!session || (session.user.role !== "admin" && session.user.role !== "super_admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const districtId = url.searchParams.get("districtId");
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
    const baseId = url.searchParams.get("baseId");
    if (baseId) {
      const tables = await listTables(creds.token, baseId);
      return NextResponse.json({ tables, token_source: creds.source });
    }
    const bases = await listBases(creds.token);
    return NextResponse.json({ bases, token_source: creds.source });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
