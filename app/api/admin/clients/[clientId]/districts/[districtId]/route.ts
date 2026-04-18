import { NextResponse } from "next/server";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";

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

export async function PATCH(
  req: Request,
  { params }: { params: { clientId: string; districtId: string } },
) {
  const ctx = await requireClientAccess(params.clientId);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    region?: string;
    country?: string;
    timezone?: string;
    default_walkbook_size?: number;
    active?: boolean;
  };

  const update: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) update.name = body.name.trim();
  if (typeof body.region === "string") update.region = body.region.trim();
  if (typeof body.country === "string") update.country = body.country.trim();
  if (typeof body.timezone === "string") update.timezone = body.timezone.trim();
  if (typeof body.default_walkbook_size === "number") update.default_walkbook_size = body.default_walkbook_size;
  if (typeof body.active === "boolean") update.active = body.active;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }

  const supabase = getSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("districts")
    .update(update)
    .eq("id", params.districtId)
    .eq("client_id", params.clientId)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ district: data });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { clientId: string; districtId: string } },
) {
  const ctx = await requireClientAccess(params.clientId);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: 403 });

  const supabase = getSupabaseServiceRoleClient();
  const { error } = await supabase
    .from("districts")
    .delete()
    .eq("id", params.districtId)
    .eq("client_id", params.clientId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
