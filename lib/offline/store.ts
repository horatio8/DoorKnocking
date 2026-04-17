"use client";

import { create } from "zustand";
import { v4 as uuid } from "uuid";
import { enqueue, pendingOutboxCount } from "./db";
import type { Household, KnockEvent, KnockStatus, Tag, Voter } from "@/lib/types";

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

function mapKnockToHouseholdStatus(status: KnockStatus) {
  switch (status) {
    case "no_answer": return "no_answer";
    case "come_back_later": return "come_back_later";
    case "refused": return "refused";
    case "contacted": return "contacted";
    case "wrong_address": return "not_knocked";
  }
}

function mapKnockToVoterStatus(status: KnockStatus) {
  switch (status) {
    case "no_answer": return "no_answer";
    case "come_back_later": return "come_back_later";
    case "refused": return "refused";
    case "contacted": return "contacted";
    case "wrong_address": return "not_contacted";
  }
}
