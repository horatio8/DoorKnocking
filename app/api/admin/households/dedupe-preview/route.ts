import { NextResponse } from "next/server";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { householdKey } from "@/lib/addresses/normalize";

// GET /api/admin/households/dedupe-preview?districtId=...
//
// Read-only: for the given district, re-hashes every household through the
// canonical match key and reports buckets where more than one household row
// collapses to the same key. Nothing is mutated — this is the safe preview
// before any actual merge.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await loadSession();
  if (!session || (session.user.role !== "admin" && session.user.role !== "super_admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const url = new URL(req.url);
  const districtId = url.searchParams.get("districtId") ?? session.district?.id;
  if (!districtId) return NextResponse.json({ error: "districtId required" }, { status: 400 });

  const supabase = getSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("households")
    .select("id, address_line1, unit, zip, lat, lng, airtable_hh_rec_id")
    .eq("district_id", districtId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as Array<{
    id: string;
    address_line1: string | null;
    unit: string | null;
    zip: string | null;
    lat: number | null;
    lng: number | null;
    airtable_hh_rec_id: string | null;
  }>;

  const buckets = new Map<
    string,
    Array<{
      id: string;
      address_line1: string | null;
      unit: string | null;
      zip: string | null;
      airtable_hh_rec_id: string | null;
    }>
  >();
  for (const r of rows) {
    const key = householdKey({ address: r.address_line1, unit: r.unit, zip: r.zip });
    const list = buckets.get(key) ?? [];
    list.push({
      id: r.id,
      address_line1: r.address_line1,
      unit: r.unit,
      zip: r.zip,
      airtable_hh_rec_id: r.airtable_hh_rec_id,
    });
    buckets.set(key, list);
  }

  const duplicates = Array.from(buckets.entries())
    .filter(([, list]) => list.length > 1)
    .map(([key, list]) => ({ key, households: list }))
    .sort((a, b) => b.households.length - a.households.length);

  return NextResponse.json({
    total_households: rows.length,
    duplicate_buckets: duplicates.length,
    households_affected: duplicates.reduce((n, b) => n + b.households.length, 0),
    buckets: duplicates.slice(0, 100),
  });
}
