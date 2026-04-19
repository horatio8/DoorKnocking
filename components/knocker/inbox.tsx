"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

interface ThreadListRow {
  id: string;
  kind: "broadcast" | "direct";
  subject: string | null;
  created_at: string;
  latest: { body: string; sent_at: string; sender_id: string | null } | null;
  unread: number;
}

interface MessageRow {
  id: string;
  sender_id: string | null;
  body: string;
  sent_at: string;
}

interface ParticipantRow {
  user_id: string;
  role: "sender" | "recipient";
  users: { full_name: string | null; email: string } | Array<{ full_name: string | null; email: string }> | null;
}

export function Inbox({ userId }: { userId: string; districtId: string | null }) {
  const [threads, setThreads] = useState<ThreadListRow[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageRow[] | null>(null);
  const [participants, setParticipants] = useState<ParticipantRow[] | null>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadThreads() {
    const res = await fetch("/api/knocker/messages");
    const body = await res.json();
    if (!res.ok) {
      setError(body.error ?? `${res.status}`);
      return;
    }
    setThreads(body.threads as ThreadListRow[]);
  }
  useEffect(() => {
    loadThreads();
  }, []);

  async function openThread(id: string) {
    setOpenId(id);
    setMessages(null);
    const res = await fetch(`/api/knocker/messages/${id}`);
    const body = await res.json();
    if (!res.ok) {
      setError(body.error ?? `${res.status}`);
      return;
    }
    setMessages(body.messages as MessageRow[]);
    setParticipants(body.participants as ParticipantRow[]);
    // Refresh unread counts in the list.
    loadThreads();
  }

  async function send() {
    if (!openId || !reply.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/knocker/messages?thread_id=${openId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: reply.trim() }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `${res.status}`);
      setReply("");
      await openThread(openId);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid h-full grid-cols-1 gap-0 md:grid-cols-[260px_1fr]">
      <aside className="overflow-y-auto border-r border-border bg-white">
        <div className="border-b border-border p-3">
          <h1 className="font-serif text-lg font-semibold text-navy-900">Inbox</h1>
          <p className="text-xs text-muted-foreground">Campaign updates and DMs.</p>
        </div>
        {error ? (
          <p className="m-3 rounded bg-crimson/10 px-3 py-2 text-xs text-crimson">{error}</p>
        ) : null}
        {threads === null ? (
          <p className="p-3 text-xs text-muted-foreground">Loading…</p>
        ) : threads.length === 0 ? (
          <p className="p-3 text-xs text-muted-foreground">No messages yet.</p>
        ) : (
          <ul>
            {threads.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => openThread(t.id)}
                  className={`block w-full border-b border-border/60 p-3 text-left hover:bg-navy-50 ${
                    openId === t.id ? "bg-navy-50" : ""
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="truncate text-sm font-medium text-navy-900">
                      {t.subject ?? (t.kind === "broadcast" ? "Campaign broadcast" : "Direct message")}
                    </p>
                    {t.unread > 0 ? (
                      <span className="inline-flex min-w-[18px] items-center justify-center rounded-full bg-navy-900 px-1.5 text-[10px] text-white">
                        {t.unread}
                      </span>
                    ) : null}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {t.latest?.body ?? <em>No messages yet</em>}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      <section className="flex flex-col overflow-hidden">
        {!openId ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Pick a conversation from the left.
          </div>
        ) : (
          <>
            <header className="border-b border-border bg-white px-4 py-3">
              <p className="text-xs uppercase tracking-widest text-navy-500">
                {participants
                  ? participants
                      .map((p) => {
                        const u = Array.isArray(p.users) ? p.users[0] : p.users;
                        return u?.full_name ?? u?.email ?? "Unknown";
                      })
                      .join(", ")
                  : ""}
              </p>
            </header>
            <div className="flex-1 overflow-y-auto bg-navy-50/30 p-4">
              {messages === null ? (
                <p className="text-xs text-muted-foreground">Loading…</p>
              ) : (
                <ul className="space-y-2">
                  {messages.map((m) => {
                    const mine = m.sender_id === userId;
                    return (
                      <li
                        key={m.id}
                        className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                          mine
                            ? "ml-auto bg-navy-900 text-white"
                            : "bg-white text-navy-900 shadow-sm"
                        }`}
                      >
                        <p>{m.body}</p>
                        <p className={`mt-1 text-[10px] ${mine ? "text-white/60" : "text-muted-foreground"}`}>
                          {new Date(m.sent_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <footer className="border-t border-border bg-white p-3">
              <div className="flex gap-2">
                <input
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  placeholder="Type a reply…"
                  className="flex-1 rounded-md border border-navy-200 px-3 py-2 text-sm"
                />
                <Button onClick={send} disabled={busy || !reply.trim()} variant="accent">
                  {busy ? "…" : "Send"}
                </Button>
              </div>
            </footer>
          </>
        )}
      </section>
    </div>
  );
}
