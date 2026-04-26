// District at-home baseline matrix (Phase Q1 default).
//
// Mirrors the table in the queue brief § 2.2. Used until the calibration
// table fills in with real knock data. Day-of-week is 0=Sunday … 6=Saturday
// (matches JavaScript's Date.getDay()).

const WEEKDAY = [1, 2, 3, 4, 5];
const WEEKEND = [0, 6];

export function defaultAtHomeRate(dayOfWeek: number, hour: number): number {
  const isWeekend = WEEKEND.includes(dayOfWeek);
  if (!isWeekend && WEEKDAY.includes(dayOfWeek)) {
    if (hour >= 7 && hour < 9) return 0.45;
    if (hour >= 9 && hour < 16) return 0.2;
    if (hour >= 16 && hour < 18) return 0.35;
    if (hour >= 18 && hour < 20) return 0.55;
    if (hour >= 20) return 0.4;
    return 0.15; // pre-7am or >= 22, low at-home = low priority
  }
  // weekend
  if (hour >= 9 && hour < 12) return 0.55;
  if (hour >= 12 && hour < 18) return 0.5;
  if (hour >= 18 && hour < 21) return 0.5;
  return 0.2; // weekend overnight
}

// Returns a 7×24 grid of the seeded values; useful when we eventually
// upsert into at_home_calibration on first generation.
export function seedCalibrationGrid(): number[][] {
  const grid: number[][] = [];
  for (let day = 0; day < 7; day++) {
    const row: number[] = [];
    for (let hour = 0; hour < 24; hour++) {
      row.push(defaultAtHomeRate(day, hour));
    }
    grid.push(row);
  }
  return grid;
}
