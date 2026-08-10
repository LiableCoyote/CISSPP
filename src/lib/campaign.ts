import { differenceInCalendarDays, parseISO } from "date-fns";
import type { Profile, QuizAttempt } from "../db/schema";
import { DOMAINS } from "../data/domains";

export const CAMPAIGN_WEEKS = 8;
export const DAYS_PER_WEEK = 7;

/**
 * Shared derivations that were each reimplemented in several components, with
 * enough drift between the copies to put different numbers on the same screen.
 */

/** Days until the exam, or null when no date is set. */
export function daysUntilExam(profile: Profile, now: Date = new Date()): number | null {
  if (!profile.examDate) return null;
  // differenceInCalendarDays, not a millisecond division: Header used
  // Math.ceil((examDate - now) / 86_400_000) and could show a different number
  // than the Dashboard at the same moment.
  return differenceInCalendarDays(parseISO(profile.examDate), now);
}

export type CampaignPosition = { daysSinceStart: number; week: number; day: number };

/** Where the user is in the 8-week plan. Clamped to the campaign's bounds. */
export function campaignPosition(profile: Profile, now: Date = new Date()): CampaignPosition {
  const daysSinceStart = Math.max(0, differenceInCalendarDays(now, parseISO(profile.startDate)));
  return {
    daysSinceStart,
    week: Math.min(CAMPAIGN_WEEKS, Math.floor(daysSinceStart / DAYS_PER_WEEK) + 1),
    day: (daysSinceStart % DAYS_PER_WEEK) + 1,
  };
}

/**
 * Average score per domain across completed attempts.
 *
 * Five components computed this, and three of them omitted the finishedAt
 * filter — so an abandoned quiz dragged their numbers away from the ones Stats
 * and the Pace Board showed.
 */
export function domainAverages(attempts: QuizAttempt[]): Map<number, number> {
  const finished = attempts.filter((a) => a.finishedAt);
  const out = new Map<number, number>();
  for (const d of DOMAINS) {
    const mine = finished.filter((a) => a.domainId === d.id);
    out.set(d.id, mine.length === 0 ? 0 : Math.round(mine.reduce((s, a) => s + a.scorePct, 0) / mine.length));
  }
  return out;
}

/** Count of domains averaging at or above `threshold`. */
export function domainsMastered(attempts: QuizAttempt[], threshold = 70): number {
  return [...domainAverages(attempts).values()].filter((avg) => avg >= threshold).length;
}

/**
 * Share of answers that were *not* flagged as technician-mindset picks, as a
 * percentage. 100 with no answers yet — an untested user is not failing.
 *
 * Takes the two counts rather than the answer rows. The Dashboard used to hold
 * the entire `answers` table in component state to derive this one number, and
 * that table grows without bound as the user studies. Two count() queries still
 * scan — `flaggedMindset` is a boolean, and booleans are not valid IndexedDB
 * keys, so it cannot be indexed — but nothing is materialised or retained.
 */
export function cisoScore(totalAnswers: number, flaggedMindset: number): number {
  if (totalAnswers <= 0) return 100;
  return Math.round(((totalAnswers - flaggedMindset) / totalAnswers) * 100);
}
