import { format, isYesterday, parseISO } from "date-fns";

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

export function getWeekKey(date: Date): string {
  // Return ISO week key: "2025-W17"
  const iso = date.toISOString().slice(0, 10);
  const d = new Date(iso);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const weekStart = new Date(d.setDate(diff));
  const weekNum = String(Math.ceil(weekStart.getDate() / 7)).padStart(2, "0");
  const year = weekStart.getFullYear();
  return `${year}-W${weekNum}`;
}
