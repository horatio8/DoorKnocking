import { NextResponse } from "next/server";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";

// POST /api/walkbooks/[id]/assign — claim a walkbook for the caller's
// knocking session. Multi-holder by design: this no longer unassigns
// prior holders or the caller's other walkbooks. Idempotent per user:
// calling with an existing active row returns it unchanged.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await loadSession();
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const supabase = getSupabaseServiceRoleClient();
  const { data: wb } = await supabase
    .from("walkbooks")
    .select("id, district_id")
    .eq("id", params.id)
    .maybeSingle();
  if (!wb) return NextResponse.json({ error: "walkbook not found" }, { status: 404 });

  // If the caller already has an active row on this walkbook, reuse it.
  const { data: existing } = await supabase
    .from("walkbook_assignments")
    .select("id")
    .eq("walkbook_id", params.id)
    .eq("user_id", session.user.id)
    .is("unassigned_at", null)
    .limit(1)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ assignmentId: (existing as { id: string }).id, already: true });
  }

  const { data: created, error } = await supabase
    .from("walkbook_assignments")
    .insert({
      walkbook_id: params.id,
      user_id: session.user.id,
      assigned_by: session.user.id,
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ assignmentId: created.id });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await loadSession();
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const supabase = getSupabaseServiceRoleClient();
  const { error } = await supabase
    .from("walkbook_assignments")
    .update({ unassigned_at: new Date().toISOString() })
    .eq("walkbook_id", params.id)
    .eq("user_id", session.user.id)
    .is("unassigned_at", null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
