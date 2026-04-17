import { NextResponse } from "next/server";
import { loadSession } from "@/lib/auth/session";
import { listBases, listTables } from "@/lib/airtable/metadata";

// GET /api/admin/airtable/discover            -> { bases }
// GET /api/admin/airtable/discover?baseId=app -> { tables }
export async function GET(req: Request) {
  const session = await loadSession();
  if (!session || (session.user.role !== "admin" && session.user.role !== "super_admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const url = new URL(req.url);
    const baseId = url.searchParams.get("baseId");
    if (baseId) {
      const tables = await listTables(baseId);
      return NextResponse.json({ tables });
    }
    const bases = await listBases();
    return NextResponse.json({ bases });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
