import { NextResponse } from "next/server";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";

// DELETE /api/walkbooks/assign/batch/[id]
// Undo a batch. Allowed only if no knock_events exist against any of the
// walkbooks in the batch since the batch was created. On success:
//   - close all assignments in the batch (unassigned_at = now)
//   - set batch.undone_at = now
//   - flip affected walkbooks back to 'open' if they have no other active
//     assignments

async function auth() {
  const session = await loadSession();
  if (!session) return { error: "forbidden" as const };
  if (session.user.role !== "admin" && session.user.role !== "super_admin") {
    return { error: "forbidden" as const };
  }
  return { session };
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await auth();
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: 403 });

  const supabase = getSupabaseServiceRoleClient();

  const { data: batch } = await supabase
    .from("assignment_batches")
    .select("id, district_id, undone_at, created_at")
    .eq("id", params.id)
    .maybeSingle();
  if (!batch) return NextResponse.json({ error: "batch not found" }, { status: 404 });
  if (batch.undone_at) return NextResponse.json({ error: "already undone" }, { status: 400 });

  const { data: assignments } = await supabase
    .from("walkbook_assignments")
    .select("id, walkbook_id")
    .eq("assignment_batch_id", params.id)
    .is("unassigned_at", null);
  const rows = (assignments ?? []) as Array<{ id: string; walkbook_id: string }>;
  const wbIds = Array.from(new Set(rows.map((r) => r.walkbook_id)));

  // Block if any knock_events happened on these walkbooks after the batch.
  if (wbIds.length > 0) {
    const { data: events } = await supabase
      .from("knock_events")
      .select("id")
      .in("walkbook_id", wbIds)
      .gt("created_at", batch.created_at as string)
      .limit(1);
    if ((events ?? []).length > 0) {
      return NextResponse.json(
        {
          error:
            "Can't undo — knock events have been logged against this batch's walkbooks. Unassign the volunteers manually instead.",
        },
        { status: 409 },
      );
    }
  }

  const nowIso = new Date().toISOString();
  await supabase
    .from("walkbook_assignments")
    .update({ unassigned_at: nowIso })
    .eq("assignment_batch_id", params.id)
    .is("unassigned_at", null);

  await supabase
    .from("assignment_batches")
    .update({ undone_at: nowIso })
    .eq("id", params.id);

  // Flip walkbooks back to 'open' where no other active assignments exist.
  if (wbIds.length > 0) {
    const { data: stillActive } = await supabase
      .from("walkbook_assignments")
      .select("walkbook_id")
      .in("walkbook_id", wbIds)
      .is("unassigned_at", null);
    const stillActiveSet = new Set(
      ((stillActive ?? []) as Array<{ walkbook_id: string }>).map((r) => r.walkbook_id),
    );
    const toReopen = wbIds.filter((id) => !stillActiveSet.has(id));
    if (toReopen.length > 0) {
      await supabase
        .from("walkbooks")
        .update({ status: "open" })
        .in("id", toReopen)
        .eq("status", "in_progress");
    }
  }

  return NextResponse.json({ ok: true, undone: rows.length });
}
