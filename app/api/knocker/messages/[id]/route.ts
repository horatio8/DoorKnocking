import { NextResponse } from "next/server";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";

// GET /api/knocker/messages/:id — list messages in a thread (and mark as read)
// PATCH /api/knocker/messages/:id — update participant state (muted, last_read_at)

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await loadSession();
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const supabase = getSupabaseServiceRoleClient();

  const { data: membership } = await supabase
    .from("message_thread_participants")
    .select("thread_id")
    .eq("thread_id", params.id)
    .eq("user_id", session.user.id)
    .maybeSingle();
  if (!membership) {
    // Allow admins/super admins to view any thread.
    if (session.user.role !== "admin" && session.user.role !== "super_admin") {
      return NextResponse.json({ error: "not a participant" }, { status: 403 });
    }
  }

  const { data: thread } = await supabase
    .from("message_threads")
    .select("id, kind, subject, district_id, created_at, created_by")
    .eq("id", params.id)
    .maybeSingle();
  if (!thread) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { data: messages } = await supabase
    .from("messages")
    .select("id, sender_id, body, sent_at, attachment_url, client_message_id")
    .eq("thread_id", params.id)
    .order("sent_at", { ascending: true });

  const { data: participants } = await supabase
    .from("message_thread_participants")
    .select("user_id, role, last_read_at, muted, users(full_name, email)")
    .eq("thread_id", params.id);

  // Mark read for the caller.
  await supabase
    .from("message_thread_participants")
    .update({ last_read_at: new Date().toISOString() })
    .eq("thread_id", params.id)
    .eq("user_id", session.user.id);

  return NextResponse.json({ thread, messages: messages ?? [], participants: participants ?? [] });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await loadSession();
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { muted?: boolean; markRead?: boolean };
  const update: Record<string, unknown> = {};
  if (typeof body.muted === "boolean") update.muted = body.muted;
  if (body.markRead) update.last_read_at = new Date().toISOString();
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }
  const supabase = getSupabaseServiceRoleClient();
  const { error } = await supabase
    .from("message_thread_participants")
    .update(update)
    .eq("thread_id", params.id)
    .eq("user_id", session.user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
