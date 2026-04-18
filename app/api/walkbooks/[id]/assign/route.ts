import { NextResponse } from "next/server";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";

// POST /api/walkbooks/[id]/assign — soft-lock: knocker claims a walkbook for
// their session. If someone else already holds it, we still succeed (spec
// §4.2: soft lock, warning shown in UI) by un-assigning the previous holder
// unless they have an active knock in progress (for now we always steal and
// let the UI warn; hard lock kicks in at first knock event in phase W4).
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

  // Release any existing active assignments on this walkbook (soft lock).
  await supabase
    .from("walkbook_assignments")
    .update({ unassigned_at: new Date().toISOString() })
    .eq("walkbook_id", params.id)
    .is("unassigned_at", null);

  // Release this user's previous active assignment on a different walkbook.
  await supabase
    .from("walkbook_assignments")
    .update({ unassigned_at: new Date().toISOString() })
    .eq("user_id", session.user.id)
    .is("unassigned_at", null);

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
