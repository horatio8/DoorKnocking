import { NextResponse } from "next/server";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";

// GET    /api/admin/users/[id]           — read one user
// PATCH  /api/admin/users/[id]           — partial update
// DELETE /api/admin/users/[id]?hard=true — soft delete (active=false) by default
//
// Access-array mutations use add/remove arrays rather than replacing the
// whole array, so two admins editing different aspects of the same user
// don't clobber each other.

async function authAdmin() {
  const session = await loadSession();
  if (!session) return { error: "forbidden" as const };
  if (session.user.role !== "admin" && session.user.role !== "super_admin") {
    return { error: "forbidden" as const };
  }
  return { session };
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await authAdmin();
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: 403 });

  const supabase = getSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "user not found" }, { status: 404 });
  return NextResponse.json({ user: data });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const ctx = await authAdmin();
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as {
    full_name?: string | null;
    role?: "knocker" | "admin" | "super_admin";
    availability?: "available" | "unavailable" | "out_in_field";
    speed_rating?: "slow" | "medium" | "fast";
    total_time_budget_minutes?: number;
    default_district_id?: string | null;
    active?: boolean;
    use_v_flow?: boolean;
    add_client_access?: string[];
    remove_client_access?: string[];
    add_district_access?: string[];
    remove_district_access?: string[];
  };

  if (body.role === "super_admin" && ctx.session.user.role !== "super_admin") {
    return NextResponse.json({ error: "only super_admins can promote to super_admin" }, { status: 403 });
  }

  const supabase = getSupabaseServiceRoleClient();
  const { data: current } = await supabase
    .from("users")
    .select("client_access, district_access")
    .eq("id", params.id)
    .maybeSingle();
  if (!current) return NextResponse.json({ error: "user not found" }, { status: 404 });

  const update: Record<string, unknown> = {};
  if (body.full_name !== undefined) update.full_name = body.full_name;
  if (body.role !== undefined) update.role = body.role;
  if (body.availability !== undefined) update.availability = body.availability;
  if (body.speed_rating !== undefined) update.speed_rating = body.speed_rating;
  if (typeof body.total_time_budget_minutes === "number")
    update.total_time_budget_minutes = body.total_time_budget_minutes;
  if (body.default_district_id !== undefined)
    update.default_district_id = body.default_district_id;
  if (typeof body.active === "boolean") update.active = body.active;
  if (typeof body.use_v_flow === "boolean") update.use_v_flow = body.use_v_flow;

  const currentClientAccess = (current.client_access as string[] | null) ?? [];
  const currentDistrictAccess = (current.district_access as string[] | null) ?? [];
  if (body.add_client_access || body.remove_client_access) {
    const set = new Set(currentClientAccess);
    for (const id of body.add_client_access ?? []) set.add(id);
    for (const id of body.remove_client_access ?? []) set.delete(id);
    update.client_access = Array.from(set);
  }
  if (body.add_district_access || body.remove_district_access) {
    const set = new Set(currentDistrictAccess);
    for (const id of body.add_district_access ?? []) set.add(id);
    for (const id of body.remove_district_access ?? []) set.delete(id);
    update.district_access = Array.from(set);
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("users")
    .update(update)
    .eq("id", params.id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ user: data });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const ctx = await authAdmin();
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: 403 });

  const url = new URL(req.url);
  const hard = url.searchParams.get("hard") === "true";

  const supabase = getSupabaseServiceRoleClient();

  if (hard) {
    if (ctx.session.user.role !== "super_admin") {
      return NextResponse.json(
        { error: "hard delete requires super_admin" },
        { status: 403 },
      );
    }
    // Remove auth entry — public.users has FK cascade via trigger / manual.
    const { error: authErr } = await supabase.auth.admin.deleteUser(params.id);
    if (authErr) return NextResponse.json({ error: authErr.message }, { status: 500 });
    await supabase.from("users").delete().eq("id", params.id);
    return NextResponse.json({ ok: true });
  }

  // Soft delete — deactivate + close any active walkbook assignments.
  const { error } = await supabase
    .from("users")
    .update({ active: false, availability: "unavailable" })
    .eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase
    .from("walkbook_assignments")
    .update({ unassigned_at: new Date().toISOString() })
    .eq("user_id", params.id)
    .is("unassigned_at", null);

  return NextResponse.json({ ok: true });
}
