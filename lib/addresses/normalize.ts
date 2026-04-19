// Normalises street address / unit / ZIP for deterministic household matching.
// The rule we enforce, per the product spec:
//
//   same street address + same unit (or both empty) → same household
//   same street address + different unit            → different households
//
// This is the fallback when an Airtable base doesn't provide a stable
// household record id; it's also reused by the walkbook estimator to detect
// when consecutive stops are inside the same apartment building.

const STREET_SUFFIX_MAP: Record<string, string> = {
  street: "st",
  str: "st",
  avenue: "ave",
  av: "ave",
  boulevard: "blvd",
  drive: "dr",
  road: "rd",
  lane: "ln",
  court: "ct",
  circle: "cir",
  place: "pl",
  terrace: "ter",
  parkway: "pkwy",
  highway: "hwy",
  plaza: "plz",
  square: "sq",
  trail: "trl",
  alley: "aly",
  crescent: "cres",
};

const DIRECTIONALS: Record<string, string> = {
  north: "n",
  south: "s",
  east: "e",
  west: "w",
  northeast: "ne",
  northwest: "nw",
  southeast: "se",
  southwest: "sw",
};

const UNIT_LABELS = new Set([
  "apt",
  "apartment",
  "unit",
  "ste",
  "suite",
  "no",
  "num",
  "number",
  "fl",
  "floor",
  "bldg",
  "building",
  "rm",
  "room",
]);

export function normalizeAddress(input: string | null | undefined): string {
  if (!input) return "";
  // Collapse whitespace, lowercase, strip most punctuation but keep "#" and "-"
  // (important inside addresses like "123-A Main St").
  const tokens = input
    .toLowerCase()
    .replace(/[.,]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((t) => {
      if (STREET_SUFFIX_MAP[t]) return STREET_SUFFIX_MAP[t];
      if (DIRECTIONALS[t]) return DIRECTIONALS[t];
      return t;
    });
  return tokens.join(" ").trim();
}

// Unit → canonical identifier. "Apt 1", "Apartment 1", "#1", "Unit 1", "No. 1",
// "1" all return "1". "5A" stays "5a". Empty / null → "".
export function normalizeUnit(input: string | null | undefined): string {
  if (!input) return "";
  const cleaned = input
    .toLowerCase()
    .replace(/[.,#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "";
  const tokens = cleaned.split(" ").filter((t) => !UNIT_LABELS.has(t));
  return tokens.join("").replace(/-/g, "");
}

// US ZIPs — first 5 characters. "12345-6789" → "12345". Empty / null → "".
export function normalizeZip(input: string | null | undefined): string {
  if (!input) return "";
  const digits = input.trim().replace(/\s/g, "");
  return digits.slice(0, 5);
}

// Unique-per-unit key. Two records with the same key should collapse to the
// same household row.
export function householdKey(opts: {
  address: string | null | undefined;
  unit: string | null | undefined;
  zip: string | null | undefined;
}): string {
  return [normalizeAddress(opts.address), normalizeUnit(opts.unit), normalizeZip(opts.zip)].join("|");
}

// Building-level key — unit intentionally dropped. Used to detect when
// consecutive walkbook stops are inside the same apartment building.
export function buildingKey(opts: {
  address: string | null | undefined;
  zip: string | null | undefined;
}): string {
  return [normalizeAddress(opts.address), normalizeZip(opts.zip)].join("|");
}
