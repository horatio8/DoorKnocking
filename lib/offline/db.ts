"use client";

import { openDB, type DBSchema, type IDBPDatabase } from "idb";

const DB_NAME = "campaignos-doorknock";
const DB_VERSION = 1;

export interface OutboxEntry {
  id: string;
  endpoint:
    | "knock_event"
    | "tag"
    | "voter_tag"
    | "survey_response"
    | "voter_note";
  payload: Record<string, unknown>;
  attempts: number;
  lastAttemptAt: number | null;
  createdAt: number;
  lastError?: string;
}

export interface SessionBundle {
  id: "current";
  userId: string;
  districtId: string;
  storedAt: number;
  households: unknown[];
  voters: unknown[];
  walkbooks: unknown[];
  surveys: unknown[];
  surveyQuestions: unknown[];
  tags: unknown[];
}

interface DoorKnockDB extends DBSchema {
  outbox: {
    key: string;
    value: OutboxEntry;
    indexes: { byEndpoint: string; byCreated: number };
  };
  session: { key: "current"; value: SessionBundle };
  mapTiles: {
    key: string;
    value: { url: string; blob: Blob; cachedAt: number };
  };
}

let dbPromise: Promise<IDBPDatabase<DoorKnockDB>> | null = null;

export function getDB() {
  if (typeof window === "undefined") {
    throw new Error("IndexedDB only available in the browser");
  }
  if (!dbPromise) {
    dbPromise = openDB<DoorKnockDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("outbox")) {
          const outbox = db.createObjectStore("outbox", { keyPath: "id" });
          outbox.createIndex("byEndpoint", "endpoint");
          outbox.createIndex("byCreated", "createdAt");
        }
        if (!db.objectStoreNames.contains("session")) {
          db.createObjectStore("session", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("mapTiles")) {
          db.createObjectStore("mapTiles", { keyPath: "url" });
        }
      },
    });
  }
  return dbPromise;
}

export async function enqueue(entry: Omit<OutboxEntry, "attempts" | "lastAttemptAt" | "createdAt">) {
  const db = await getDB();
  const full: OutboxEntry = {
    ...entry,
    attempts: 0,
    lastAttemptAt: null,
    createdAt: Date.now(),
  };
  await db.put("outbox", full);
  return full;
}

export async function pendingOutbox(): Promise<OutboxEntry[]> {
  const db = await getDB();
  return db.getAllFromIndex("outbox", "byCreated");
}

// Stuck / dead entries (attempts maxed out) are no longer counted here — the
// sync worker prunes them separately so the badge doesn't sit forever on a
// number that will never clear.
export async function pendingOutboxCount(maxAttempts = 10): Promise<number> {
  const db = await getDB();
  const all = await db.getAll("outbox");
  return all.filter((e) => e.attempts < maxAttempts).length;
}

export async function deadOutboxEntries(maxAttempts = 10): Promise<OutboxEntry[]> {
  const db = await getDB();
  const all = await db.getAll("outbox");
  return all.filter((e) => e.attempts >= maxAttempts);
}

export async function deleteOutbox(id: string) {
  const db = await getDB();
  await db.delete("outbox", id);
}

export async function markOutboxAttempt(entry: OutboxEntry, error?: string) {
  const db = await getDB();
  await db.put("outbox", {
    ...entry,
    attempts: entry.attempts + 1,
    lastAttemptAt: Date.now(),
    lastError: error,
  });
}

export async function saveSessionBundle(bundle: Omit<SessionBundle, "id" | "storedAt">) {
  const db = await getDB();
  await db.put("session", { ...bundle, id: "current", storedAt: Date.now() });
}

export async function loadSessionBundle(): Promise<SessionBundle | null> {
  const db = await getDB();
  return (await db.get("session", "current")) ?? null;
}

export async function clearSessionBundle() {
  const db = await getDB();
  await db.delete("session", "current");
}
