import { NextResponse } from "next/server";
import { loadSession } from "@/lib/auth/session";
import { getActiveClient } from "@/lib/clients/active";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import {
  clearAirtableToken,
  getAirtableCredentialStatus,
  saveAirtableToken,
} from "@/lib/airtable/credentials";
import { verifyToken } from "@/lib/airtable/metadata";

// GET  — return status (presence + verification date), NEVER the token
// PUT  — { token: string, clientId?: string } — save + verify against Airtable
// DELETE — remove
//
// clientId override is honoured only for super_admin sessions. All other
// callers are forced to the client resolved by the current subdomain.

type ResolveResult =
  | { error: "forbidden" | "no_client" | "client_not_found" }
  | {
      session: Awaited<ReturnType<typeof loadSession>> & object;
      client: { id: string; name: string };
    };

async function resolveTargetClient(
  req: Request,
  explicitClientId: string | null,
): Promise<ResolveResult> {
  const session = await loadSession();
  if (!session || (session.user.role !== "admin" && session.user.role !== "super_admin")) {
    return { error: "forbidden" };
  }

  if (explicitClientId && session.user.role === "super_admin") {
    const supabase = getSupabaseServiceRoleClient();
    const { data } = await supabase
      .from("clients")
      .select("id, name")
      .eq("id", explicitClientId)
      .maybeSingle();
    if (!data) return { error: "client_not_found" };
    return { session, client: { id: data.id as string, name: data.name as string } };
  }

  const active = await getActiveClient();
  if (!active) return { error: "no_client" };
  return { session, client: { id: active.id, name: active.name } };
}

function errorPayload(err: "forbidden" | "no_client" | "client_not_found") {
  if (err === "forbidden") return { body: { error: "forbidden" }, status: 403 };
  if (err === "client_not_found")
    return { body: { error: "client not found" }, status: 404 };
  return { body: { error: "no active client in context" }, status: 400 };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const ctx = await resolveTargetClient(req, url.searchParams.get("clientId"));
  if ("error" in ctx) {
    const { body, status } = errorPayload(ctx.error);
    return NextResponse.json(body, { status });
  }
  const status = await getAirtableCredentialStatus(ctx.client.id);
  return NextResponse.json(status);
}

export async function PUT(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    token?: string;
    workspace_id?: string;
    clientId?: string;
  };
  const ctx = await resolveTargetClient(req, body.clientId ?? null);
  if ("error" in ctx) {
    const { body: errBody, status } = errorPayload(ctx.error);
    return NextResponse.json(errBody, { status });
  }

  const token = body.token?.trim();
  if (!token) return NextResponse.json({ error: "token required" }, { status: 400 });
  if (!token.startsWith("pat")) {
    return NextResponse.json(
      { error: "Airtable PATs start with 'pat…'. Paste the full value including the dot and secret." },
      { status: 400 },
    );
  }

  const check = await verifyToken(token);
  if (!check.ok) {
    return NextResponse.json({ error: `Token rejected by Airtable: ${check.error}` }, { status: 400 });
  }

  await saveAirtableToken({
    clientId: ctx.client.id,
    token,
    workspaceId: body.workspace_id ?? null,
    updatedBy: ctx.session.user.id,
    verifiedAt: new Date(),
  });

  return NextResponse.json({ ok: true, base_count: check.base_count });
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const ctx = await resolveTargetClient(req, url.searchParams.get("clientId"));
  if ("error" in ctx) {
    const { body, status } = errorPayload(ctx.error);
    return NextResponse.json(body, { status });
  }
  await clearAirtableToken(ctx.client.id);
  return NextResponse.json({ ok: true });
}
