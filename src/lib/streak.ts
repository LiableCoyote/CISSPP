import { getISOWeek, getISOWeekYear } from "date-fns";

/**
 * ISO week key, e.g. "2025-W17".
 *
 * The previous implementation divided the day-of-month by 7, producing a
 * week-of-month: 3 January and 5 February both returned "W01", so the weekly
 * streak-freeze allowance reset unpredictably.
 */
export function getWeekKey(date: Date): string {
  const week = String(getISOWeek(date)).padStart(2, "0");
  return `${getISOWeekYear(date)}-W${week}`;
}
