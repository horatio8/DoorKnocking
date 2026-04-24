import { NextResponse } from "next/server";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";

// GET /api/admin/import-jobs/[id]
//   Returns the current row for one import_jobs record. The upload
//   wizard polls this every few seconds to render live progress while
//   the cron worker is running. Light enough to poll aggressively.

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await loadSession();
  if (!session || (session.user.role !== "admin" && session.user.role !== "super_admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const supabase = getSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("import_jobs")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ job: data });
}
