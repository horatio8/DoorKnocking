// Per-volunteer-session state for the prototype flow.
// Lives in localStorage so screens can navigate without query strings.
// In production this is replaced by Supabase + an idb mirror.

export type SupportLevel =
  | "strong-yes"
  | "lean-yes"
  | "undecided"
  | "lean-no"
  | "strong-no";

export type NonContact = "not-home" | "refused" | "moved" | "language";

export type DoorOutcome = SupportLevel | NonContact;

export type DoorResult = {
  doorN: number;
  outcome: DoorOutcome;
  contactedAt: string;
};

export type VolunteerSession = {
  firstName: string;
  candidateName: string;
  electionDate: string;
  selectedMinutes: number | null;
  walkbookId: string;
  walkbookName: string;
  doorsTotal: number;
  startedAt: string | null;
  results: DoorResult[];
};

const STORAGE_KEY = "volunteer.session.v1";

export const defaultSession = (): VolunteerSession => ({
  firstName: "James",
  candidateName: "Sprouse for SC House 115",
  electionDate: "May 14",
  selectedMinutes: null,
  walkbookId: "wb_riverland",
  walkbookName: "Riverland Woods",
  doorsTotal: 18,
  startedAt: null,
  results: [],
});

export function loadSession(): VolunteerSession {
  if (typeof window === "undefined") return defaultSession();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSession();
    const parsed = JSON.parse(raw) as Partial<VolunteerSession>;
    return { ...defaultSession(), ...parsed };
  } catch {
    return defaultSession();
  }
}

export function saveSession(session: VolunteerSession) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function patchSession(patch: Partial<VolunteerSession>): VolunteerSession {
  const next = { ...loadSession(), ...patch };
  saveSession(next);
  return next;
}

export function resetSession(): VolunteerSession {
  const next = defaultSession();
  saveSession(next);
  return next;
}
