import { NextResponse } from "next/server";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";

// GET /api/knocker/messages                — list threads for this user
// POST /api/knocker/messages?thread_id=…    — post a reply in a thread
// POST /api/knocker/messages (thread body)  — start a new direct thread with a recipient

interface ThreadRow {
  id: string;
  kind: "broadcast" | "direct";
  subject: string | null;
  district_id: string;
  created_at: string;
  created_by: string | null;
}

export async function GET() {
  const session = await loadSession();
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const supabase = getSupabaseServiceRoleClient();

  const { data: parts } = await supabase
    .from("message_thread_participants")
    .select("thread_id, last_read_at, muted")
    .eq("user_id", session.user.id);
  const ids = (parts ?? []).map((p: { thread_id: string }) => p.thread_id);
  if (ids.length === 0) return NextResponse.json({ threads: [] });

  const { data: threads } = await supabase
    .from("message_threads")
    .select("id, kind, subject, district_id, created_at, created_by")
    .in("id", ids)
    .order("created_at", { ascending: false });

  // Latest message per thread + unread count.
  const latestByThread = new Map<string, { body: string; sent_at: string; sender_id: string | null }>();
  const unreadByThread = new Map<string, number>();
  const { data: msgs } = await supabase
    .from("messages")
    .select("thread_id, body, sent_at, sender_id")
    .in("thread_id", ids)
    .order("sent_at", { ascending: false });
  const lastReadByThread = new Map<string, string | null>(
    ((parts ?? []) as Array<{ thread_id: string; last_read_at: string | null }>).map((p) => [
      p.thread_id,
      p.last_read_at,
    ]),
  );
  for (const m of (msgs ?? []) as Array<{
    thread_id: string;
    body: string;
    sent_at: string;
    sender_id: string | null;
  }>) {
    if (!latestByThread.has(m.thread_id)) {
      latestByThread.set(m.thread_id, { body: m.body, sent_at: m.sent_at, sender_id: m.sender_id });
    }
    const lastRead = lastReadByThread.get(m.thread_id);
    if (m.sender_id !== session.user.id && (!lastRead || m.sent_at > lastRead)) {
      unreadByThread.set(m.thread_id, (unreadByThread.get(m.thread_id) ?? 0) + 1);
    }
  }

  return NextResponse.json({
    threads: ((threads ?? []) as ThreadRow[]).map((t) => ({
      ...t,
      latest: latestByThread.get(t.id) ?? null,
      unread: unreadByThread.get(t.id) ?? 0,
    })),
  });
}

export async function POST(req: Request) {
  const session = await loadSession();
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const url = new URL(req.url);
  const threadId = url.searchParams.get("thread_id");
  const body = (await req.json().catch(() => ({}))) as {
    body?: string;
    recipientIds?: string[];
    subject?: string;
    districtId?: string;
    clientMessageId?: string;
  };

  if (!body.body || body.body.trim().length === 0) {
    return NextResponse.json({ error: "body required" }, { status: 400 });
  }
  const supabase = getSupabaseServiceRoleClient();

  let tid = threadId;
  if (!tid) {
    // Start a new direct thread.
    const districtId = body.districtId ?? session.district?.id;
    if (!districtId) return NextResponse.json({ error: "districtId required" }, { status: 400 });
    const recips = (body.recipientIds ?? []).filter((x) => typeof x === "string");
    if (recips.length === 0) {
      return NextResponse.json({ error: "recipientIds required" }, { status: 400 });
    }
    const { data: thread, error: tErr } = await supabase
      .from("message_threads")
      .insert({
        district_id: districtId,
        kind: "direct",
        subject: body.subject ?? null,
        created_by: session.user.id,
      })
      .select("id")
      .single();
    if (tErr || !thread) return NextResponse.json({ error: tErr?.message ?? "thread create failed" }, { status: 500 });
    tid = thread.id as string;
    const parts = [
      { thread_id: tid, user_id: session.user.id, role: "sender" },
      ...recips.map((uid) => ({ thread_id: tid!, user_id: uid, role: "recipient" })),
    ];
    const { error: pErr } = await supabase.from("message_thread_participants").insert(parts);
    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });
  }

  const { data: msg, error: mErr } = await supabase
    .from("messages")
    .insert({
      thread_id: tid,
      sender_id: session.user.id,
      body: body.body.trim(),
      client_message_id: body.clientMessageId ?? null,
    })
    .select("*")
    .single();
  if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 });

  return NextResponse.json({ thread_id: tid, message: msg });
}
