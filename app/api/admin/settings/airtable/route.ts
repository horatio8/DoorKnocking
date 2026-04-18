import { NextResponse } from "next/server";
import { loadSession } from "@/lib/auth/session";
import { getActiveClient } from "@/lib/clients/active";
import {
  clearAirtableToken,
  getAirtableCredentialStatus,
  saveAirtableToken,
} from "@/lib/airtable/credentials";
import { verifyToken } from "@/lib/airtable/metadata";

// GET  — return status (presence + verification date), NEVER the token
// PUT  — { token: string } — save + verify against Airtable
// DELETE — remove
// POST { action: "verify" } — re-verify currently stored token

async function requireAdminClient() {
  const session = await loadSession();
  if (!session || (session.user.role !== "admin" && session.user.role !== "super_admin")) {
    return { error: "forbidden" as const };
  }
  const client = await getActiveClient();
  if (!client) {
    return { error: "no_client" as const };
  }
  return { session, client };
}

export async function GET() {
  const ctx = await requireAdminClient();
  if ("error" in ctx) {
    return NextResponse.json(
      { error: ctx.error === "forbidden" ? "forbidden" : "no active client in context" },
      { status: ctx.error === "forbidden" ? 403 : 400 },
    );
  }
  const status = await getAirtableCredentialStatus(ctx.client.id);
  return NextResponse.json(status);
}

export async function PUT(req: Request) {
  const ctx = await requireAdminClient();
  if ("error" in ctx) {
    return NextResponse.json(
      { error: ctx.error === "forbidden" ? "forbidden" : "no active client in context" },
      { status: ctx.error === "forbidden" ? 403 : 400 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as { token?: string; workspace_id?: string };
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

export async function DELETE() {
  const ctx = await requireAdminClient();
  if ("error" in ctx) {
    return NextResponse.json(
      { error: ctx.error === "forbidden" ? "forbidden" : "no active client in context" },
      { status: ctx.error === "forbidden" ? 403 : 400 },
    );
  }
  await clearAirtableToken(ctx.client.id);
  return NextResponse.json({ ok: true });
}
