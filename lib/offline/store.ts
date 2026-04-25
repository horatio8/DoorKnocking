"use client";

import { create } from "zustand";
import { v4 as uuid } from "uuid";
import { enqueue, pendingOutboxCount } from "./db";
import type {
  Household,
  HouseholdStatus,
  KnockEvent,
  KnockStatus,
  Tag,
  Voter,
  VoterStatus,
} from "@/lib/types";

interface FieldState {
  userId: string | null;
  districtId: string | null;
  households: Map<string, Household>;
  voters: Map<string, Voter>;
  tags: Map<string, Tag>;
  pendingCount: number;
  lastSyncAt: number | null;
  online: boolean;

  hydrate(payload: {
    userId: string;
    districtId: string;
    households: Household[];
    voters: Voter[];
    tags: Tag[];
  }): void;
  // Sets just the authenticated user + district without touching the
  // rest of the field state. Called from the knocker shell so routes
  // that don't mount the map (household detail, survey runner, etc.)
  // still have a hydrated user for recordKnock.
  setIdentity(userId: string, districtId: string): void;
  applyKnockOptimistic(event: Omit<KnockEvent, "synced_at" | "created_at">): KnockEvent;
  recordKnock(input: {
    household: Household;
    voterId: string | null;
    status: KnockStatus;
    walkbookId: string | null;
    surveyId: string | null;
    notes?: string;
  }): Promise<KnockEvent>;
  refreshPendingCount(): Promise<void>;
  setOnline(online: boolean): void;
}

export const useFieldStore = create<FieldState>((set, get) => ({
  userId: null,
  districtId: null,
  households: new Map(),
  voters: new Map(),
  tags: new Map(),
  pendingCount: 0,
  lastSyncAt: null,
  online: typeof navigator !== "undefined" ? navigator.onLine : true,

  hydrate({ userId, districtId, households, voters, tags }) {
    set({
      userId,
      districtId,
      households: new Map(households.map((h) => [h.id, h])),
      voters: new Map(voters.map((v) => [v.id, v])),
      tags: new Map(tags.map((t) => [t.id, t])),
      lastSyncAt: Date.now(),
    });
  },

  setIdentity(userId, districtId) {
    // Only patch identity — leaves households/voters/tags alone so a
    // later full hydrate() from the map page isn't clobbered.
    const cur = get();
    if (cur.userId === userId && cur.districtId === districtId) return;
    set({ userId, districtId });
  },

  applyKnockOptimistic(event) {
    const household = get().households.get(event.household_id);
    if (household) {
      const nextStatus = mapKnockToHouseholdStatus(event.status);
      const updated = { ...household, status: nextStatus, last_knocked_at: event.knocked_at };
      const households = new Map(get().households);
      households.set(household.id, updated);
      set({ households });
    }
    if (event.voter_id) {
      const voter = get().voters.get(event.voter_id);
      if (voter) {
        const voters = new Map(get().voters);
        voters.set(voter.id, {
          ...voter,
          current_status: mapKnockToVoterStatus(event.status),
          last_knock_event_id: event.id,
        });
        set({ voters });
      }
    }
    return { ...event, synced_at: new Date().toISOString(), created_at: new Date().toISOString() };
  },

  async recordKnock({ household, voterId, status, walkbookId, surveyId, notes }) {
    const userId = get().userId;
    if (!userId) throw new Error("No user hydrated");
    const now = new Date().toISOString();
    const clientEventId = uuid();
    const event: KnockEvent = {
      id: clientEventId,
      household_id: household.id,
      voter_id: voterId,
      user_id: userId,
      walkbook_id: walkbookId,
      status,
      knocked_at: now,
      synced_at: now,
      client_event_id: clientEventId,
      duration_seconds: null,
      notes: notes ?? null,
      survey_id: surveyId,
      survey_completed: false,
      survey_partial: false,
      conflict_flag: false,
      created_at: now,
    };
    get().applyKnockOptimistic(event);
    const payload = {
      id: clientEventId,
      client_event_id: clientEventId,
      household_id: household.id,
      voter_id: voterId,
      user_id: userId,
      walkbook_id: walkbookId,
      status,
      knocked_at: now,
      duration_seconds: null,
      notes: notes ?? null,
      survey_id: surveyId,
    };

    // Online path: POST to /api/knocker/knock-event so the server
    // (service role) writes the row immediately and surfaces any
    // schema/FK error back to the door, instead of disappearing
    // silently into the outbox flush. The previous browser-RLS
    // upsert was rejecting silently in some installs and the
    // volunteer ended up at /app/survey/<id> staring at a
    // "Couldn't find that knock" dead end.
    //
    // We only fall back to the outbox if the POST itself fails
    // (network blip, 5xx) — that way the volunteer's work is never
    // lost, but online failures get a real on-screen error instead
    // of being deferred forever.
    const online = typeof navigator !== "undefined" && navigator.onLine;
    if (online) {
      try {
        const res = await fetch("/api/knocker/knock-event", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          keepalive: true,
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as {
            error?: string;
            detail?: string;
          };
          const message =
            body.detail ?? body.error ?? `knock save failed (${res.status})`;
          console.error("[survey:record-knock] api commit failed", {
            knockEventId: clientEventId,
            surveyId,
            status: res.status,
            message,
          });
          // Throw so handleCommit at the door sees the failure and
          // doesn't navigate the volunteer into a runner that won't
          // find the row.
          throw new Error(message);
        }
        console.info("[survey:record-knock] api commit ok", {
          knockEventId: clientEventId,
          surveyId,
        });
        // Successful server write — no need to enqueue anything.
        return event;
      } catch (err) {
        // Differentiate network-style failures from app-level errors.
        // Network failure = enqueue + return (the row will sync via
        // the outbox worker). App-level error (api returned 4xx/5xx
        // with a body) = re-throw so the door surfaces the real
        // message; the optimistic local event is still in the store.
        const message = (err as Error).message;
        const looksLikeNetwork =
          message === "Failed to fetch" ||
          message === "NetworkError when attempting to fetch resource." ||
          message.toLowerCase().includes("fetch failed");
        if (!looksLikeNetwork) {
          throw err;
        }
        console.warn(
          "[survey:record-knock] api commit network error — falling back to outbox",
          { knockEventId: clientEventId, message },
        );
      }
    }

    // Offline (or transient network failure mid-POST) — queue the
    // payload so the background sync worker picks it up later.
    await enqueue({
      id: clientEventId,
      endpoint: "knock_event",
      payload,
    });
    await get().refreshPendingCount();
    console.info("[survey:record-knock] queued for offline sync", {
      knockEventId: clientEventId,
      surveyId,
      online,
    });
    return event;
  },

  async refreshPendingCount() {
    const count = await pendingOutboxCount();
    set({ pendingCount: count });
  },

  setOnline(online) {
    set({ online });
  },
}));

function mapKnockToHouseholdStatus(status: KnockStatus): HouseholdStatus {
  switch (status) {
    case "no_answer": return "no_answer";
    case "come_back_later": return "come_back_later";
    case "refused": return "refused";
    case "contacted": return "contacted";
    case "wrong_address": return "not_knocked";
  }
}

function mapKnockToVoterStatus(status: KnockStatus): VoterStatus {
  switch (status) {
    case "no_answer": return "no_answer";
    case "come_back_later": return "come_back_later";
    case "refused": return "refused";
    case "contacted": return "contacted";
    case "wrong_address": return "not_contacted";
  }
}
