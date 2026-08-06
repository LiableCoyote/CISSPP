import { format, isYesterday, parseISO, getISOWeek, getISOWeekYear } from "date-fns";

export function updateStreak(lastActiveDate: string | null, currentDate: Date): {
  streak: number;
  longestStreak: number;
  reset: boolean;
} {
  const today = format(currentDate, "yyyy-MM-dd");

  // No prior activity = day 1
  if (!lastActiveDate) {
    return { streak: 1, longestStreak: 1, reset: false };
  }

  const lastDate = parseISO(lastActiveDate);

  // Already active today = no change
  if (format(lastDate, "yyyy-MM-dd") === today) {
    return { streak: 0, longestStreak: 0, reset: false };
  }

  // Active yesterday = continue streak
  if (isYesterday(lastDate)) {
    return { streak: 1, longestStreak: 0, reset: false };
  }

  // Gap > 1 day = reset (unless freeze is used)
  return { streak: 1, longestStreak: 0, reset: true };
}

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
