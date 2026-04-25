"use client";

import { create } from "zustand";
import { v4 as uuid } from "uuid";
import { enqueue, pendingOutboxCount } from "./db";
import { flushOutbox } from "./sync";
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
    await enqueue({
      id: clientEventId,
      endpoint: "knock_event",
      payload: {
        // Use the client-generated UUID as the row id too. This keeps
        // the id stable across client + server so the survey runner
        // (which navigates to /app/survey/<id>) can resolve the row
        // as soon as the outbox flushes.
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
      },
    });
    await get().refreshPendingCount();
    // Kick the outbox immediately so the server row exists by the time
    // handleCommit routes to /app/survey/<id>. Offline (or flush fail)
    // falls back to the 30-second background worker; the optimistic
    // local event is already in the store either way.
    if (typeof navigator !== "undefined" && navigator.onLine) {
      try {
        const result = await flushOutbox();
        await get().refreshPendingCount();
        console.info("[survey:record-knock] outbox flushed", {
          knockEventId: clientEventId,
          surveyId,
          ...result,
        });
        if (result.failed > 0) {
          console.warn(
            "[survey:record-knock] flush left failures — survey runner may show 'Couldn't find that knock'",
            { knockEventId: clientEventId, failed: result.failed },
          );
        }
      } catch (err) {
        console.warn(
          "[survey:record-knock] immediate flush failed; will retry via worker",
          { knockEventId: clientEventId, error: (err as Error).message },
        );
      }
    } else {
      console.info("[survey:record-knock] offline at commit; queued in outbox", {
        knockEventId: clientEventId,
        surveyId,
      });
    }
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
