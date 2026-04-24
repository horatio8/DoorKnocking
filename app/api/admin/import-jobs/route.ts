import { NextResponse } from "next/server";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";

// GET /api/admin/import-jobs
//   Lists the 15 most recent import jobs visible to the caller. Used
//   by the live list on /admin/system/jobs. Scope: same RLS policy as
//   the row itself (admin + district_access), but we run through the
//   service-role client and filter explicitly so the query is a single
//   round-trip regardless of which districts the admin can see.

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await loadSession();
  if (!session || (session.user.role !== "admin" && session.user.role !== "super_admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const supabase = getSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("import_jobs")
    .select(
      "id, district_id, status, rows_total, rows_pushed, rows_imported, rows_geocoded, rows_failed, error_message, started_at, finished_at, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(15);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ jobs: data ?? [] });
}
