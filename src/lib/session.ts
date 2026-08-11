import { format, subDays } from "date-fns";
import { db, type Profile } from "../db/schema";
import { publishLastActive } from "./reminders";

export type SessionLog = {
  minutes: number;
  /** Cards reviewed, for flashcard sessions. */
  flashcardsReviewed?: number;
  questsCompleted?: number;
};

/**
 * Records a study session in the daily log and advances the streak.
 *
 * Extracted because quizzes, flashcards, quests and the Vault each need exactly
 * this and had grown their own near-identical copies — the Vault's was simply
 * missing, so drilling it never counted as studying.
 *
 * Returns the profile patch the caller should apply, so callers that also award
 * XP can do it in a single updateProfile call.
 */
export async function logStudySession(
  profile: Profile,
  entry: SessionLog,
): Promise<Partial<Profile>> {
  const today = format(new Date(), "yyyy-MM-dd");
  const minutes = Math.max(1, Math.round(entry.minutes));

  const existing = await db.studyLog.get(today);
  if (existing) {
    await db.studyLog.update(today, {
      minutes: existing.minutes + minutes,
      sessions: existing.sessions + 1,
      questsCompleted: existing.questsCompleted + (entry.questsCompleted ?? 0),
      flashcardsReviewed: existing.flashcardsReviewed + (entry.flashcardsReviewed ?? 0),
    });
  } else {
    await db.studyLog.add({
      date: today,
      minutes,
      sessions: 1,
      questsCompleted: entry.questsCompleted ?? 0,
      flashcardsReviewed: entry.flashcardsReviewed ?? 0,
    });
  }

  // Publish for the service worker before the early return: a second session on
  // the same day still needs the reminder state to be current, and the streak
  // being already advanced says nothing about whether the cache was written.
  await publishLastActive(today);

  // Already counted today — nothing to advance.
  if (profile.lastActiveDate === today) return {};

  const yesterday = format(subDays(new Date(), 1), "yyyy-MM-dd");
  const streak = profile.lastActiveDate === yesterday ? profile.streak + 1 : 1;
  return {
    lastActiveDate: today,
    streak,
    longestStreak: Math.max(profile.longestStreak, streak),
  };
}
