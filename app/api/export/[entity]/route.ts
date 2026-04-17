import { NextResponse } from "next/server";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const ALLOWED = new Set(["voters", "households", "knock_events", "survey_responses"]);

export async function GET(req: Request, { params }: { params: { entity: string } }) {
  const session = await loadSession();
  if (!session || (session.user.role !== "admin" && session.user.role !== "super_admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (!ALLOWED.has(params.entity)) {
    return NextResponse.json({ error: "unknown entity" }, { status: 400 });
  }

  const url = new URL(req.url);
  const districtId = url.searchParams.get("district");
  const supabase = getSupabaseServerClient();
  const query = supabase.from(params.entity).select("*");
  // knock_events and survey_responses don't carry district_id directly — scope via voters/households.
  if (params.entity === "voters" || params.entity === "households") {
    if (districtId) query.eq("district_id", districtId);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = data ?? [];
  const headers = rows.length > 0 ? Object.keys(rows[0] as Record<string, unknown>) : [];
  const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => escape(((r as Record<string, unknown>)[h]))).join(","))].join("\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${params.entity}.csv"`,
    },
  });
}

function escape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "string" ? v : JSON.stringify(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
