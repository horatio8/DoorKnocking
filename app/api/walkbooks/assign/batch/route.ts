import { NextResponse } from "next/server";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";

// POST /api/walkbooks/assign/batch
//   body: {
//     districtId: string,
//     method: "manual" | "auto" | "hybrid",
//     notes?: string,
//     assignments: Array<{ walkbookId: string; userId: string | null }>
//   }
//
// Additive multi-holder semantics: each (walkbookId, userId) pair adds
// a user to a walkbook if they're not already on it. Existing active
// assignments for other users on the same walkbook are NOT wiped —
// multiple volunteers can share a walkbook. userId=null pairs are
// skipped (no-op); removing a specific volunteer is handled by the
// per-pair unassign endpoints, not this batch.
// Walkbooks that gain an assignee flip to status='in_progress' if
// they were open.

export const maxDuration = 60;

interface Body {
  districtId: string;
  method: "manual" | "auto" | "hybrid";
  notes?: string;
  assignments: Array<{ walkbookId: string; userId: string | null }>;
}

async function auth() {
  const session = await loadSession();
  if (!session) return { error: "forbidden" as const };
  if (session.user.role !== "admin" && session.user.role !== "super_admin") {
    return { error: "forbidden" as const };
  }
  return { session };
}

export async function POST(req: Request) {
  const ctx = await auth();
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as Body;
  if (!body.districtId || !Array.isArray(body.assignments) || body.assignments.length === 0) {
    return NextResponse.json({ error: "districtId + non-empty assignments required" }, { status: 400 });
  }
  if (!["manual", "auto", "hybrid"].includes(body.method)) {
    return NextResponse.json({ error: "method must be manual | auto | hybrid" }, { status: 400 });
  }

  const supabase = getSupabaseServiceRoleClient();

  // Fetch walkbook stats for the batch row.
  const wbIds = body.assignments.map((a) => a.walkbookId);
  const { data: wbRows } = await supabase
    .from("walkbooks")
    .select("id, household_count, estimated_duration_minutes, target_duration_minutes, district_id")
    .in("id", wbIds);
  const wbById = new Map(
    ((wbRows ?? []) as Array<{
      id: string;
      household_count: number;
      estimated_duration_minutes: number | null;
      target_duration_minutes: number | null;
      district_id: string;
    }>).map((w) => [w.id, w]),
  );

  // Guard: every walkbook must belong to the requested district.
  for (const a of body.assignments) {
    const w = wbById.get(a.walkbookId);
    if (!w) {
      return NextResponse.json({ error: `walkbook ${a.walkbookId} not found` }, { status: 404 });
    }
    if (w.district_id !== body.districtId) {
      return NextResponse.json(
        { error: `walkbook ${a.walkbookId} is not in district ${body.districtId}` },
        { status: 400 },
      );
    }
  }

  const effective = body.assignments.filter((a) => a.userId !== null) as Array<{
    walkbookId: string;
    userId: string;
  }>;
  const uniqueVolunteers = new Set(effective.map((a) => a.userId));
  const totalDuration = body.assignments.reduce((sum, a) => {
    const w = wbById.get(a.walkbookId);
    if (!w) return sum;
    return sum + (w.estimated_duration_minutes ?? w.target_duration_minutes ?? 0);
  }, 0);
  const totalDoors = body.assignments.reduce((sum, a) => {
    const w = wbById.get(a.walkbookId);
    return sum + (w?.household_count ?? 0);
  }, 0);

  // 1. Batch row.
  const { data: batch, error: batchErr } = await supabase
    .from("assignment_batches")
    .insert({
      district_id: body.districtId,
      created_by: ctx.session.user.id,
      method: body.method,
      walkbook_count: body.assignments.length,
      volunteer_count: uniqueVolunteers.size,
      total_duration_minutes: totalDuration,
      total_doors: totalDoors,
      notes: body.notes ?? null,
    })
    .select("id")
    .single();
  if (batchErr || !batch) {
    return NextResponse.json({ error: batchErr?.message ?? "batch insert failed" }, { status: 500 });
  }

  // 2. Additive inserts. Look up which (walkbook, user) pairs already
  // have an active row and skip them so re-running a batch doesn't pile
  // up duplicates. Other volunteers already on the same walkbooks stay
  // assigned — multi-holder by design.
  if (effective.length > 0) {
    const { data: existingRows } = await supabase
      .from("walkbook_assignments")
      .select("walkbook_id, user_id")
      .in("walkbook_id", wbIds)
      .in("user_id", effective.map((a) => a.userId))
      .is("unassigned_at", null);
    const existingPairs = new Set(
      ((existingRows ?? []) as Array<{ walkbook_id: string; user_id: string }>).map(
        (r) => `${r.walkbook_id}:${r.user_id}`,
      ),
    );
    const rows = effective
      .filter((a) => !existingPairs.has(`${a.walkbookId}:${a.userId}`))
      .map((a) => ({
        walkbook_id: a.walkbookId,
        user_id: a.userId,
        assigned_by: ctx.session.user.id,
        assignment_batch_id: batch.id,
        assignment_notes: body.notes ?? null,
      }));
    if (rows.length > 0) {
      const { error: insErr } = await supabase.from("walkbook_assignments").insert(rows);
      if (insErr) {
        return NextResponse.json({ error: insErr.message, batchId: batch.id }, { status: 500 });
      }
    }
  }

  // 4. Move assigned walkbooks to in_progress (only if currently open).
  if (effective.length > 0) {
    const assignedWbIds = effective.map((a) => a.walkbookId);
    await supabase
      .from("walkbooks")
      .update({ status: "in_progress" })
      .in("id", assignedWbIds)
      .eq("status", "open");
  }

  return NextResponse.json({
    ok: true,
    batchId: batch.id,
    walkbookCount: body.assignments.length,
    volunteerCount: uniqueVolunteers.size,
    totalDurationMinutes: totalDuration,
    totalDoors,
  });
}
