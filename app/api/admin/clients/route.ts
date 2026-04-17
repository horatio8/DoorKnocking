import { NextResponse } from "next/server";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const session = await loadSession();
  if (!session || session.user.role !== "super_admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const {
    slug,
    name,
    contact_email,
    short_name,
    primary_color,
    accent_color,
    district_slug,
    district_name,
    district_country,
    district_region,
    airtable_base_id,
    airtable_voters_table_id,
    timezone,
  } = body as Record<string, string | undefined>;

  if (!slug || !name || !district_slug || !district_name) {
    return NextResponse.json({ error: "slug, name, district_slug, district_name are required" }, { status: 400 });
  }
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json({ error: "slug must be lowercase letters, numbers, and hyphens" }, { status: 400 });
  }

  const supabase = getSupabaseServiceRoleClient();

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .insert({
      slug,
      name,
      contact_email: contact_email || null,
      brand: {
        short_name: short_name || name,
        primary_color: primary_color || "#0B1F3A",
        accent_color: accent_color || "#B5121B",
      },
    })
    .select()
    .single();

  if (clientError) {
    return NextResponse.json({ error: clientError.message }, { status: 500 });
  }

  const { error: districtError } = await supabase
    .from("districts")
    .insert({
      slug: district_slug,
      name: district_name,
      country: district_country || "US",
      region: district_region || "",
      airtable_base_id: airtable_base_id || null,
      airtable_voters_table_id: airtable_voters_table_id || null,
      timezone: timezone || "UTC",
      client_id: client.id,
    });

  if (districtError) {
    // Roll back the client so the admin can retry cleanly.
    await supabase.from("clients").delete().eq("id", client.id);
    return NextResponse.json({ error: districtError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    client_id: client.id,
    client_slug: client.slug,
    url: `https://${client.slug}.campaignos.com`,
  });
}
