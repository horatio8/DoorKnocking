import { NextResponse } from "next/server";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";

// POST /api/walkbooks/:id/self-assign
//   Gentle claim from the knocker's own UI (map pin popover, browse list).
//   Unlike /assign which steals from any prior holder, this one refuses if
//   the walkbook is already assigned to someone else — steal is reserved
//   for the "start knock session" path where intent is explicit.
//
//   Idempotent for the same knocker: re-calling just returns the existing
//   assignment row.
//
// DELETE /api/walkbooks/:id/self-assign
//   Only works if assigned_by == user_id (the knocker self-selected it).
//   Admin-issued assignments (assigned_by is someone else) are protected —
//   the knocker has to ask their admin to remove those.

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await loadSession();
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const supabase = getSupabaseServiceRoleClient();
  const { data: wb } = await supabase
    .from("walkbooks")
    .select("id")
    .eq("id", params.id)
    .maybeSingle();
  if (!wb) return NextResponse.json({ error: "walkbook not found" }, { status: 404 });

  const { data: current } = await supabase
    .from("walkbook_assignments")
    .select("id, user_id, assigned_by")
    .eq("walkbook_id", params.id)
    .is("unassigned_at", null)
    .limit(1)
    .maybeSingle();
  const active = current as
    | { id: string; user_id: string; assigned_by: string | null }
    | null;

  if (active && active.user_id !== session.user.id) {
    return NextResponse.json(
      { error: "already_assigned", message: "Another volunteer is currently on this walkbook." },
      { status: 409 },
    );
  }
  if (active && active.user_id === session.user.id) {
    return NextResponse.json({ ok: true, assignmentId: active.id, already: true });
  }

  const { data: created, error } = await supabase
    .from("walkbook_assignments")
    .insert({
      walkbook_id: params.id,
      user_id: session.user.id,
      assigned_by: session.user.id, // self-assigned flag — DELETE guards on this
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, assignmentId: created.id });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await loadSession();
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const supabase = getSupabaseServiceRoleClient();
  const { data: row } = await supabase
    .from("walkbook_assignments")
    .select("id, assigned_by, user_id")
    .eq("walkbook_id", params.id)
    .eq("user_id", session.user.id)
    .is("unassigned_at", null)
    .limit(1)
    .maybeSingle();
  const active = row as { id: string; assigned_by: string | null } | null;
  if (!active) {
    return NextResponse.json({ ok: true, already: true });
  }
  if (active.assigned_by !== session.user.id) {
    return NextResponse.json(
      {
        error: "admin_assigned",
        message:
          "Your admin assigned this walkbook — ask them to remove it if you don't want it.",
      },
      { status: 403 },
    );
  }

  const { error } = await supabase
    .from("walkbook_assignments")
    .update({ unassigned_at: new Date().toISOString() })
    .eq("id", active.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
