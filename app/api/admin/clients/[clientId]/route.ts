import { NextResponse } from "next/server";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";

// GET    — read one client
// PATCH  — update name, slug, contact_email, brand, active
// DELETE — delete client (cascades to districts via FK)
//
// All routes super_admin-only. Regular admins see their client at
// /admin/settings and edit via dedicated endpoints — they don't get to
// rename/delete the client row itself.

async function requireSuperAdmin() {
  const session = await loadSession();
  if (!session) return { error: "forbidden" as const };
  if (session.user.role !== "super_admin") return { error: "forbidden" as const };
  return { session };
}

interface Brand {
  short_name?: string;
  primary_color?: string;
  accent_color?: string;
  logo_url?: string;
}

export async function GET(_req: Request, { params }: { params: { clientId: string } }) {
  const ctx = await requireSuperAdmin();
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: 403 });

  const supabase = getSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("clients")
    .select("id, slug, name, brand, contact_email, active, created_at")
    .eq("id", params.clientId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "client not found" }, { status: 404 });
  return NextResponse.json({ client: data });
}

export async function PATCH(req: Request, { params }: { params: { clientId: string } }) {
  const ctx = await requireSuperAdmin();
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    slug?: string;
    contact_email?: string | null;
    brand?: Brand;
    active?: boolean;
  };

  const update: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) update.name = body.name.trim();
  if (typeof body.slug === "string" && body.slug.trim()) {
    const slug = body.slug.trim().toLowerCase();
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return NextResponse.json(
        { error: "slug must be lowercase letters, numbers, and hyphens" },
        { status: 400 },
      );
    }
    update.slug = slug;
  }
  if ("contact_email" in body) {
    update.contact_email = body.contact_email?.trim() || null;
  }
  if (body.brand && typeof body.brand === "object") {
    const supabase = getSupabaseServiceRoleClient();
    const { data: existing } = await supabase
      .from("clients")
      .select("brand")
      .eq("id", params.clientId)
      .maybeSingle();
    const current = ((existing?.brand as Brand | null) ?? {}) as Brand;
    update.brand = { ...current, ...body.brand };
  }
  if (typeof body.active === "boolean") update.active = body.active;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }

  const supabase = getSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("clients")
    .update(update)
    .eq("id", params.clientId)
    .select()
    .single();
  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "slug already taken by another client" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ client: data });
}

export async function DELETE(req: Request, { params }: { params: { clientId: string } }) {
  const ctx = await requireSuperAdmin();
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: 403 });

  const url = new URL(req.url);
  const confirmSlug = url.searchParams.get("confirmSlug");

  const supabase = getSupabaseServiceRoleClient();
  const { data: existing } = await supabase
    .from("clients")
    .select("slug")
    .eq("id", params.clientId)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: "client not found" }, { status: 404 });
  if (confirmSlug !== existing.slug) {
    return NextResponse.json(
      { error: "confirmSlug does not match — pass the client's slug to proceed" },
      { status: 400 },
    );
  }

  const { error } = await supabase.from("clients").delete().eq("id", params.clientId);
  if (error) {
    if (error.code === "23503") {
      return NextResponse.json(
        {
          error:
            "Foreign-key violation — the client still has dependent data (voters, walkbooks, users) that doesn't cascade. Deactivate the client instead, or remove those rows first.",
        },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
