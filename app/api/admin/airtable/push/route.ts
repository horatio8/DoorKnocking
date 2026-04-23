import { NextResponse } from "next/server";
import { loadSession } from "@/lib/auth/session";

// POST /api/admin/airtable/push
//   { import_file_id }
//
// Pushes a staged file to the canonical Airtable base and then runs the
// regular importer so Supabase ends up in sync too. Full implementation
// lands in Commit 4; this stub returns a clear pending response so the
// wizard renders gracefully in the meantime.

export const maxDuration = 300;

export async function POST(req: Request) {
  const session = await loadSession();
  if (!session || (session.user.role !== "admin" && session.user.role !== "super_admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  // NOTE: implemented in the push-from-file commit.
  return NextResponse.json(
    { error: "push pipeline not wired yet — this will be hooked up in the next commit" },
    { status: 501 },
  );
}
