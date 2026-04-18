import { NextResponse } from "next/server";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";

interface DistrictCreate {
  slug?: string;
  name?: string;
  country?: string;
  region?: string;
  timezone?: string;
  default_walkbook_size?: number;
  airtable_base_id?: string | null;
  airtable_voters_table_id?: string | null;
}

async function requireClientAccess(clientId: string) {
  const session = await loadSession();
  if (!session) return { error: "forbidden" as const };
  if (session.user.role !== "super_admin" && session.user.role !== "admin") {
    return { error: "forbidden" as const };
  }
  if (session.user.role !== "super_admin") {
    const supabase = getSupabaseServiceRoleClient();
    const { data: user } = await supabase
      .from("users")
      .select("client_access")
      .eq("id", session.user.id)
      .maybeSingle();
    const access = ((user?.client_access as string[] | undefined) ?? []).map(String);
    if (!access.includes(clientId)) return { error: "forbidden" as const };
  }
  return { session };
}

export async function GET(_req: Request, { params }: { params: { clientId: string } }) {
  const ctx = await requireClientAccess(params.clientId);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: 403 });

  const supabase = getSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("districts")
    .select(
      "id, slug, name, country, region, timezone, active, airtable_base_id, airtable_voters_table_id, airtable_import_status, airtable_last_imported_at, created_at",
    )
    .eq("client_id", params.clientId)
    .order("created_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ districts: data ?? [] });
}

export async function POST(req: Request, { params }: { params: { clientId: string } }) {
  const ctx = await requireClientAccess(params.clientId);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as DistrictCreate;
  const slug = body.slug?.trim().toLowerCase();
  const name = body.name?.trim();
  if (!slug || !name || !body.country || !body.region) {
    return NextResponse.json({ error: "slug, name, country, region required" }, { status: 400 });
  }
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json({ error: "slug must be lowercase letters, numbers, and hyphens" }, { status: 400 });
  }

  const supabase = getSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("districts")
    .insert({
      client_id: params.clientId,
      slug,
      name,
      country: body.country,
      region: body.region,
      timezone: body.timezone || "UTC",
      default_walkbook_size: body.default_walkbook_size ?? 20,
      airtable_base_id: body.airtable_base_id ?? null,
      airtable_voters_table_id: body.airtable_voters_table_id ?? null,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ district: data });
}
