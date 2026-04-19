// Stable color for a walkbook, derived from its id so the same walkbook
// always paints the same hue regardless of array position or filter state.
// Used by both the list cards and the overview map so the two match.

const GREY = "#9ca3af";

export function walkbookColor(id: string): string {
  // djb2 hash → 0..359 hue. Saturation/lightness fixed for cohesion.
  let hash = 5381;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 33) ^ id.charCodeAt(i);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 65%, 45%)`;
}

export function walkbookColorWithGrey(id: string, grey: boolean): string {
  return grey ? GREY : walkbookColor(id);
}

export { GREY as WALKBOOK_GREY };
