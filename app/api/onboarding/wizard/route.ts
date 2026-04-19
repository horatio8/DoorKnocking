import { NextResponse } from "next/server";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";

// POST /api/onboarding/wizard
// Body: { step, payload }
//
// step=1  { name, role }                          → users.full_name + users.role
// step=2  { campaign, candidate, election, travel }→ create or update clients + first district
// step=3  { country, region, district, target_voters, airtable }→ first districts row + Airtable base id
//
// On step 3 finish we also stamp users.setup_completed_at so the trial
// banner + admin layout can tell the user is fully onboarded.

export async function POST(req: Request) {
  const session = await loadSession();
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as {
    step?: 1 | 2 | 3;
    payload?: Record<string, unknown>;
  };
  const payload = body.payload ?? {};
  const supabase = getSupabaseServiceRoleClient();

  try {
    if (body.step === 1) {
      const name = String(payload.name ?? "").trim();
      const role = String(payload.role ?? "consultant");
      await supabase
        .from("users")
        .update({ full_name: name || null })
        .eq("id", session.user.id);
      // Role is informational (used to pick templates) — we store it in props
      // until the signup_funnel_events pipe picks it up.
      await supabase.from("signup_funnel_events").insert({
        event: "wizard_step_1",
        user_id: session.user.id,
        props: { name, role },
      });
      return NextResponse.json({ ok: true });
    }

    if (body.step === 2) {
      const name = String(payload.campaign ?? "").trim();
      if (!name) return NextResponse.json({ error: "campaign required" }, { status: 400 });
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 48);

      // Create (or re-use) the first client for this user.
      const { data: existing } = await supabase
        .from("clients")
        .select("id, client_access")
        .contains("client_access", [session.user.id])
        .limit(1)
        .maybeSingle();

      let clientId = (existing as { id: string } | null)?.id ?? null;
      if (!clientId) {
        const { data: created, error } = await supabase
          .from("clients")
          .insert({ name, slug, active: true })
          .select("id")
          .single();
        if (error || !created) {
          return NextResponse.json({ error: error?.message ?? "client create failed" }, { status: 500 });
        }
        clientId = created.id as string;
      } else {
        await supabase.from("clients").update({ name, slug }).eq("id", clientId);
      }

      // Ensure the signing-up user has access to this client.
      const { data: prof } = await supabase
        .from("users")
        .select("client_access")
        .eq("id", session.user.id)
        .maybeSingle();
      const clientAccess = new Set(
        ((prof as { client_access: string[] | null } | null)?.client_access ?? []) as string[],
      );
      clientAccess.add(clientId!);
      await supabase
        .from("users")
        .update({ client_access: Array.from(clientAccess) })
        .eq("id", session.user.id);

      await supabase.from("signup_funnel_events").insert({
        event: "wizard_step_2",
        user_id: session.user.id,
        props: {
          campaign: name,
          candidate: payload.candidate ?? null,
          election: payload.election ?? null,
          travel: payload.travel ?? null,
          client_id: clientId,
        },
      });

      return NextResponse.json({ ok: true, client_id: clientId });
    }

    if (body.step === 3) {
      // Create the first district for this user's first client.
      const districtName = String(payload.district ?? "").trim();
      if (!districtName) return NextResponse.json({ error: "district required" }, { status: 400 });

      const { data: prof } = await supabase
        .from("users")
        .select("client_access, default_district_id")
        .eq("id", session.user.id)
        .maybeSingle();
      const clientIds = ((prof as { client_access: string[] | null } | null)?.client_access ?? []) as string[];
      const clientId = clientIds[0] ?? null;
      if (!clientId) return NextResponse.json({ error: "no client on this user" }, { status: 400 });

      const slug = districtName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 48);
      const { data: district, error: dErr } = await supabase
        .from("districts")
        .insert({
          name: districtName,
          slug,
          country: String(payload.country ?? "United States"),
          region: String(payload.region ?? ""),
          client_id: clientId,
          active: true,
        })
        .select("id")
        .single();
      if (dErr || !district) {
        return NextResponse.json({ error: dErr?.message ?? "district create failed" }, { status: 500 });
      }
      const districtId = district.id as string;

      await supabase
        .from("users")
        .update({
          default_district_id: districtId,
          district_access: [districtId],
          setup_completed_at: new Date().toISOString(),
        })
        .eq("id", session.user.id);

      // Optional Airtable base id captured for later OAuth hand-off.
      const baseId = String(payload.airtable_base_id ?? "").trim() || null;
      if (baseId) {
        await supabase
          .from("districts")
          .update({ airtable_base_id: baseId })
          .eq("id", districtId);
      }

      await supabase.from("signup_funnel_events").insert({
        event: "wizard_complete",
        user_id: session.user.id,
        props: {
          district_id: districtId,
          target_voters: payload.target_voters ?? null,
          airtable_base_id: baseId,
        },
      });

      return NextResponse.json({ ok: true, district_id: districtId, client_id: clientId });
    }

    return NextResponse.json({ error: "unknown step" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
