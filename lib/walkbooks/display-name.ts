// Converts a compact walkbook identifier stored in the DB (e.g. "115 — 36" or
// "115 - 36") into the full display form the product copy asks for
// ("District 115 · Walkbook 36"). Defensive: if the name doesn't match the
// pattern we return it untouched so custom walkbook names aren't mangled.

const PATTERN = /^(\d{1,4})\s*[—\-–]\s*(\d{1,4})$/;

export function formatWalkbookName(name: string | null | undefined): string {
  if (!name) return "";
  const m = name.match(PATTERN);
  if (!m) return name;
  return `District ${m[1]} · Walkbook ${m[2]}`;
}

// Short form for very tight spots (small chips, pin popovers). Returns e.g.
// "WB 36" when the name matches, otherwise the original.
export function formatWalkbookShort(name: string | null | undefined): string {
  if (!name) return "";
  const m = name.match(PATTERN);
  if (!m) return name;
  return `WB ${m[2]}`;
}
