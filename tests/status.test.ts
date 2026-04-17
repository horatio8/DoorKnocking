import { describe, expect, it } from "vitest";

/**
 * Pure TS mirror of the Supabase trigger for status derivation.
 * Lets us unit-test the invariants without spinning up Postgres.
 */
type VoterStatus = "not_contacted" | "no_answer" | "come_back_later" | "refused" | "contacted";
type HouseholdStatus =
  | "not_knocked"
  | "no_answer"
  | "come_back_later"
  | "refused"
  | "contacted"
  | "mixed";

function deriveHouseholdStatus(statuses: VoterStatus[]): HouseholdStatus {
  if (statuses.length === 0) return "not_knocked";
  const unique = new Set(statuses);
  if (unique.size > 1) return "mixed";
  const only = [...unique][0];
  switch (only) {
    case "not_contacted": return "not_knocked";
    case "no_answer": return "no_answer";
    case "come_back_later": return "come_back_later";
    case "refused": return "refused";
    case "contacted": return "contacted";
  }
}

describe("deriveHouseholdStatus", () => {
  it("not_knocked when no residents", () => {
    expect(deriveHouseholdStatus([])).toBe("not_knocked");
  });
  it("maps single status through", () => {
    expect(deriveHouseholdStatus(["contacted"])).toBe("contacted");
    expect(deriveHouseholdStatus(["refused"])).toBe("refused");
  });
  it("mixed when residents disagree", () => {
    expect(deriveHouseholdStatus(["contacted", "refused"])).toBe("mixed");
  });
});
