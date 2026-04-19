import { NextResponse } from "next/server";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";

// POST /api/admin/users/batch
//   body: {
//     clientId: string,
//     invites: Array<{
//       email: string,
//       fullName?: string,
//       role: 'knocker' | 'admin',
//       districtId?: string
//     }>
//   }
//
// For each row:
//   - If an auth user with this email already exists, ADD the clientId to
//     their users.client_access and (if districtId given) the districtId
//     to users.district_access. Don't re-invite. Don't overwrite their
//     role. Returns status='linked'.
//   - Otherwise, send a Supabase invite email and initialise their
//     users row. Returns status='invited'.
//
// Response: { results: Array<{ email, status, error? }> }.
// One email per row. Per-row failures don't abort the batch.

interface InviteRow {
  email: string;
  fullName?: string;
  role: "knocker" | "admin";
  districtId?: string;
}

interface Body {
  clientId: string;
  invites: InviteRow[];
}

export const maxDuration = 60;

async function authAdmin() {
  const session = await loadSession();
  if (!session) return { error: "forbidden" as const };
  if (session.user.role !== "admin" && session.user.role !== "super_admin") {
    return { error: "forbidden" as const };
  }
  return { session };
}

export async function POST(req: Request) {
  const ctx = await authAdmin();
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as Body;
  if (!body.clientId) {
    return NextResponse.json({ error: "clientId required" }, { status: 400 });
  }
  if (!Array.isArray(body.invites) || body.invites.length === 0) {
    return NextResponse.json({ error: "invites[] required" }, { status: 400 });
  }

  const supabase = getSupabaseServiceRoleClient();
  const origin =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    req.headers.get("origin") ??
    "http://localhost:3000";

  const results: Array<{ email: string; status: "linked" | "invited" | "error"; error?: string }> = [];

  // One page of auth users is enough at our scale (<1k). For bigger systems,
  // paginate with the filter.
  const { data: authList } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const byEmail = new Map<string, string>();
  for (const u of authList?.users ?? []) {
    if (u.email) byEmail.set(u.email.toLowerCase(), u.id);
  }

  for (const row of body.invites) {
    const email = row.email.trim().toLowerCase();
    if (!email) {
      results.push({ email: row.email, status: "error", error: "empty email" });
      continue;
    }
    const existingAuthId = byEmail.get(email);

    try {
      if (existingAuthId) {
        // Fetch current access arrays to merge.
        const { data: existing } = await supabase
          .from("users")
          .select("client_access, district_access, default_district_id, role")
          .eq("id", existingAuthId)
          .maybeSingle();
        const clientAccess = new Set(((existing?.client_access as string[] | null) ?? []));
        clientAccess.add(body.clientId);
        const districtAccess = new Set(((existing?.district_access as string[] | null) ?? []));
        if (row.districtId) districtAccess.add(row.districtId);

        await supabase
          .from("users")
          .update({
            client_access: Array.from(clientAccess),
            district_access: Array.from(districtAccess),
            // Don't overwrite default_district_id if user already has one —
            // they're being added to a new client, not replanted.
            default_district_id:
              existing?.default_district_id ?? row.districtId ?? null,
          })
          .eq("id", existingAuthId);

        results.push({ email, status: "linked" });
      } else {
        const { data: inv, error: invErr } = await supabase.auth.admin.inviteUserByEmail(email, {
          data: { full_name: row.fullName ?? null },
          redirectTo: `${origin}/set-password`,
        });
        if (invErr || !inv.user) {
          results.push({ email, status: "error", error: invErr?.message ?? "invite failed" });
          continue;
        }
        await supabase
          .from("users")
          .update({
            full_name: row.fullName ?? null,
            role: row.role,
            default_district_id: row.districtId ?? null,
            district_access: row.districtId ? [row.districtId] : [],
            client_access: [body.clientId],
            active: true,
          })
          .eq("id", inv.user.id);
        results.push({ email, status: "invited" });
      }
    } catch (err) {
      results.push({ email, status: "error", error: (err as Error).message });
    }
  }

  const summary = {
    linked: results.filter((r) => r.status === "linked").length,
    invited: results.filter((r) => r.status === "invited").length,
    errors: results.filter((r) => r.status === "error").length,
  };

  return NextResponse.json({ results, ...summary });
}
