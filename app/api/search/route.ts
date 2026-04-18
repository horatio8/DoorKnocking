import { NextResponse } from "next/server";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { getActiveClient } from "@/lib/clients/active";

// GET /api/search?q=term
// Returns up to N matches per category across voters, households, walkbooks,
// districts, users, surveys, tags, clients. Scopes to the active client
// unless the caller is super_admin on the apex (then searches every client).

export const dynamic = "force-dynamic";

const PER_CATEGORY = 5;

interface Hit {
  kind: "voter" | "household" | "walkbook" | "district" | "user" | "survey" | "tag" | "client";
  id: string;
  title: string;
  subtitle?: string;
  href: string;
}

export async function GET(req: Request) {
  const session = await loadSession();
  if (!session || (session.user.role !== "admin" && session.user.role !== "super_admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ hits: [], q });

  const supabase = getSupabaseServiceRoleClient();
  const active = await getActiveClient();
  const isSuper = session.user.role === "super_admin";
  const like = `%${q.replace(/[%_]/g, "\\$&")}%`;
  const hits: Hit[] = [];

  // District-scoped set — all districts in the active client (or all for super_admin on apex).
  let districtIds: string[] = [];
  {
    const q1 = supabase.from("districts").select("id");
    if (active) q1.eq("client_id", active.id);
    const { data } = await q1;
    districtIds = ((data ?? []) as Array<{ id: string }>).map((d) => d.id);
  }

  // Voters — first/middle/last/display/state_voter_id/phone.
  if (districtIds.length > 0) {
    const { data: voters } = await supabase
      .from("voters")
      .select("id, display_name, first_name, last_name, primary_phone, state_voter_id, household_id, district_id")
      .in("district_id", districtIds)
      .or(
        `display_name.ilike.${like},first_name.ilike.${like},last_name.ilike.${like},primary_phone.ilike.${like},state_voter_id.ilike.${like}`,
      )
      .limit(PER_CATEGORY);
    for (const v of (voters ?? []) as Array<{
      id: string;
      display_name: string | null;
      first_name: string | null;
      last_name: string | null;
      primary_phone: string | null;
      state_voter_id: string | null;
      household_id: string;
      district_id: string;
    }>) {
      const name = v.display_name ?? [v.first_name, v.last_name].filter(Boolean).join(" ");
      hits.push({
        kind: "voter",
        id: v.id,
        title: name || "(unnamed voter)",
        subtitle: [v.state_voter_id, v.primary_phone].filter(Boolean).join(" · ") || undefined,
        href: `/admin/households/${v.household_id}`,
      });
    }
  }

  // Households — address line / city / zip.
  if (districtIds.length > 0) {
    const { data: hh } = await supabase
      .from("households")
      .select("id, address_line1, city, state, zip, unit")
      .in("district_id", districtIds)
      .or(`address_line1.ilike.${like},city.ilike.${like},zip.ilike.${like}`)
      .limit(PER_CATEGORY);
    for (const h of (hh ?? []) as Array<{
      id: string;
      address_line1: string;
      city: string | null;
      state: string | null;
      zip: string | null;
      unit: string | null;
    }>) {
      const line = [h.address_line1, h.unit ? `#${h.unit}` : null].filter(Boolean).join(" ");
      const loc = [h.city, h.state, h.zip].filter(Boolean).join(", ");
      hits.push({
        kind: "household",
        id: h.id,
        title: line,
        subtitle: loc || undefined,
        href: `/admin/households/${h.id}`,
      });
    }
  }

  // Walkbooks — name.
  if (districtIds.length > 0) {
    const { data: wb } = await supabase
      .from("walkbooks")
      .select("id, name, household_count, status, district_id")
      .in("district_id", districtIds)
      .ilike("name", like)
      .limit(PER_CATEGORY);
    for (const w of (wb ?? []) as Array<{
      id: string;
      name: string;
      household_count: number;
      status: string;
    }>) {
      hits.push({
        kind: "walkbook",
        id: w.id,
        title: w.name,
        subtitle: `${w.household_count} doors · ${w.status}`,
        href: `/admin/walkbooks/${w.id}`,
      });
    }
  }

  // Districts — name / slug / region.
  {
    const q1 = supabase
      .from("districts")
      .select("id, name, slug, region")
      .or(`name.ilike.${like},slug.ilike.${like},region.ilike.${like}`)
      .limit(PER_CATEGORY);
    if (active && !isSuper) q1.eq("client_id", active.id);
    const { data } = await q1;
    for (const d of (data ?? []) as Array<{ id: string; name: string; slug: string; region: string }>) {
      hits.push({
        kind: "district",
        id: d.id,
        title: d.name,
        subtitle: [d.region, d.slug].filter(Boolean).join(" · "),
        href: `/admin/districts`,
      });
    }
  }

  // Users — email / full_name. Scoped to client_access if non-super.
  {
    const q1 = supabase.from("users").select("id, email, full_name, role").limit(PER_CATEGORY).or(
      `email.ilike.${like},full_name.ilike.${like}`,
    );
    const { data } = await q1;
    for (const u of (data ?? []) as Array<{ id: string; email: string; full_name: string | null; role: string }>) {
      hits.push({
        kind: "user",
        id: u.id,
        title: u.full_name ?? u.email,
        subtitle: `${u.role} · ${u.email}`,
        href: `/admin/users`,
      });
    }
  }

  // Surveys — name.
  if (districtIds.length > 0) {
    const { data: surveys } = await supabase
      .from("surveys")
      .select("id, name, active, district_id")
      .in("district_id", districtIds)
      .ilike("name", like)
      .limit(PER_CATEGORY);
    for (const s of (surveys ?? []) as Array<{ id: string; name: string; active: boolean }>) {
      hits.push({
        kind: "survey",
        id: s.id,
        title: s.name,
        subtitle: s.active ? "active" : "archived",
        href: `/admin/surveys/${s.id}`,
      });
    }
  }

  // Tags — label. Scoped to district.
  if (districtIds.length > 0) {
    const { data: tags } = await supabase
      .from("tags")
      .select("id, label, district_id")
      .in("district_id", districtIds)
      .ilike("label", like)
      .limit(PER_CATEGORY);
    for (const t of (tags ?? []) as Array<{ id: string; label: string }>) {
      hits.push({ kind: "tag", id: t.id, title: t.label, href: `/admin/tags` });
    }
  }

  // Clients — super_admin only, searches all; regular admin sees own.
  {
    const q1 = supabase
      .from("clients")
      .select("id, name, slug")
      .or(`name.ilike.${like},slug.ilike.${like}`)
      .limit(PER_CATEGORY);
    const { data } = await q1;
    for (const c of (data ?? []) as Array<{ id: string; name: string; slug: string }>) {
      if (!isSuper && active && c.id !== active.id) continue;
      hits.push({
        kind: "client",
        id: c.id,
        title: c.name,
        subtitle: c.slug,
        href: isSuper ? `/admin/clients/${c.slug}/settings` : `/admin/settings`,
      });
    }
  }

  return NextResponse.json({ hits, q });
}
