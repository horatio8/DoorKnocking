import { NextResponse } from "next/server";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { resolveAirtableTokenForDistrict } from "@/lib/airtable/credentials";
import {
  addCanonicalTablesToBase,
  provisionCanonicalBase,
} from "@/lib/airtable/provisioning";
import { listBases } from "@/lib/airtable/metadata";

// POST /api/admin/airtable/provision
//   body: { district_id, base_id?, workspace_id?, name? }
//
// Installs the canonical four-table schema (Voters, Households, Knocks,
// Conversations) into the client's Airtable. Two modes:
//
//   base_id     → add tables to an existing base the admin picked.
//                 Skips createBase entirely, so no workspace_id needed.
//                 Fails cleanly if that base already has tables with
//                 canonical names (no silent clobber).
//   workspace_id → creates a fresh base inside that workspace, then
//                 populates the four tables.
//
// Idempotent: if the district already points at a canonical base, the
// stored ids are returned unchanged.
//
// GET /api/admin/airtable/provision?district_id=...
//   Returns:
//     suggested: saved workspace_id (if any)
//     bases: [{ id, name, permissionLevel }] — every base the admin's
//            token can see, for the "pick existing" dropdown.

export const maxDuration = 180;

export async function GET(req: Request) {
  const session = await loadSession();
  if (!session || (session.user.role !== "admin" && session.user.role !== "super_admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const districtId = new URL(req.url).searchParams.get("district_id");
  if (!districtId) return NextResponse.json({ error: "district_id required" }, { status: 400 });
  const creds = await resolveAirtableTokenForDistrict(districtId);
  if (!creds?.token) {
    return NextResponse.json({ error: "no airtable token" }, { status: 412 });
  }
  let bases: Array<{ id: string; name: string; permissionLevel?: string }> = [];
  try {
    bases = await listBases(creds.token);
  } catch (err) {
    // Non-fatal — the create-new-base path still works via paste-a-
    // workspace-id. Log and continue.
    console.warn("[provision] listBases failed:", (err as Error).message);
  }
  return NextResponse.json({
    suggested: creds.workspaceId ?? null,
    bases,
  });
}

export async function POST(req: Request) {
  const session = await loadSession();
  if (!session || (session.user.role !== "admin" && session.user.role !== "super_admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    district_id?: string;
    base_id?: string;
    workspace_id?: string;
    name?: string;
  };
  if (!body.district_id) {
    return NextResponse.json({ error: "district_id required" }, { status: 400 });
  }

  const supabase = getSupabaseServiceRoleClient();
  const { data: districtRow } = await supabase
    .from("districts")
    .select(
      "id, name, airtable_is_canonical, airtable_base_id, airtable_voters_table_id, airtable_households_table_id, airtable_knocks_table_id, airtable_conversations_table_id",
    )
    .eq("id", body.district_id)
    .maybeSingle();
  const district = districtRow as
    | {
        id: string;
        name: string;
        airtable_is_canonical: boolean;
        airtable_base_id: string | null;
        airtable_voters_table_id: string | null;
        airtable_households_table_id: string | null;
        airtable_knocks_table_id: string | null;
        airtable_conversations_table_id: string | null;
      }
    | null;
  if (!district) return NextResponse.json({ error: "district not found" }, { status: 404 });

  // Idempotency — if we already provisioned, short-circuit.
  if (
    district.airtable_is_canonical &&
    district.airtable_base_id &&
    district.airtable_voters_table_id &&
    district.airtable_households_table_id &&
    district.airtable_knocks_table_id &&
    district.airtable_conversations_table_id
  ) {
    return NextResponse.json({
      base_id: district.airtable_base_id,
      table_ids: {
        voters: district.airtable_voters_table_id,
        households: district.airtable_households_table_id,
        knocks: district.airtable_knocks_table_id,
        conversations: district.airtable_conversations_table_id,
      },
      reused: true,
    });
  }

  const creds = await resolveAirtableTokenForDistrict(body.district_id);
  if (!creds?.token) {
    return NextResponse.json({ error: "no airtable token — connect Airtable first" }, { status: 412 });
  }

  try {
    let result;
    if (body.base_id) {
      // Add to an existing base. No workspace_id needed.
      result = await addCanonicalTablesToBase(creds.token, body.base_id);
    } else {
      const workspaceId = body.workspace_id ?? creds.workspaceId;
      if (!workspaceId) {
        return NextResponse.json(
          { error: "workspace_id or base_id required" },
          { status: 400 },
        );
      }
      const name = body.name ?? `${district.name} — Voters`;
      result = await provisionCanonicalBase(creds.token, { workspaceId, name });
    }

    const { error: updErr } = await supabase
      .from("districts")
      .update({
        airtable_base_id: result.baseId,
        airtable_voters_table_id: result.tableIdsByKey.voters,
        airtable_households_table_id: result.tableIdsByKey.households,
        airtable_knocks_table_id: result.tableIdsByKey.knocks,
        airtable_conversations_table_id: result.tableIdsByKey.conversations,
        airtable_is_canonical: true,
      })
      .eq("id", district.id);
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
    return NextResponse.json({
      base_id: result.baseId,
      table_ids: result.tableIdsByKey,
      reused: false,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
