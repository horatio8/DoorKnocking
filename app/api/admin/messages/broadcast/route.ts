import { NextResponse } from "next/server";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";

// POST /api/admin/messages/broadcast
// Create a broadcast thread to every knocker in a district (or filtered set).

export async function POST(req: Request) {
  const session = await loadSession();
  if (!session || (session.user.role !== "admin" && session.user.role !== "super_admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    districtId?: string;
    subject?: string;
    body?: string;
    recipientIds?: string[];
  };
  if (!body.body || body.body.trim().length === 0) {
    return NextResponse.json({ error: "body required" }, { status: 400 });
  }
  if (!body.districtId) {
    return NextResponse.json({ error: "districtId required" }, { status: 400 });
  }
  const supabase = getSupabaseServiceRoleClient();

  // Resolve recipients — either an explicit set or every knocker in the district.
  let recipients: string[] = body.recipientIds ?? [];
  if (recipients.length === 0) {
    const { data: knockers } = await supabase
      .from("users")
      .select("id")
      .eq("role", "knocker")
      .contains("district_access", [body.districtId]);
    recipients = ((knockers ?? []) as Array<{ id: string }>).map((u) => u.id);
  }
  if (recipients.length === 0) {
    return NextResponse.json({ error: "no recipients in this district" }, { status: 400 });
  }

  const { data: thread, error: tErr } = await supabase
    .from("message_threads")
    .insert({
      district_id: body.districtId,
      kind: "broadcast",
      subject: body.subject ?? null,
      created_by: session.user.id,
    })
    .select("id")
    .single();
  if (tErr || !thread) {
    return NextResponse.json({ error: tErr?.message ?? "thread create failed" }, { status: 500 });
  }
  const tid = thread.id as string;

  const parts = [
    { thread_id: tid, user_id: session.user.id, role: "sender" as const },
    ...recipients
      .filter((u) => u !== session.user.id)
      .map((uid) => ({ thread_id: tid, user_id: uid, role: "recipient" as const })),
  ];
  await supabase.from("message_thread_participants").insert(parts);

  const { error: mErr } = await supabase.from("messages").insert({
    thread_id: tid,
    sender_id: session.user.id,
    body: body.body.trim(),
  });
  if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, thread_id: tid, recipients: parts.length - 1 });
}
