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
  const patch = await applyStudySession(profile, entry);
  // Outside applyStudySession because this is a Cache API write, and a Dexie
  // transaction does not survive a non-Dexie await. Keeping it here is what
  // lets the award paths call applyStudySession inside a transaction.
  await publishLastActive(format(new Date(), "yyyy-MM-dd"));
  return patch;
}

/**
 * The Dexie half of the above: writes the day's row and returns the streak
 * patch, touching nothing but IndexedDB.
 *
 * Split out so an award can be atomic. The quiz and quest handlers mark
 * themselves claimed before crediting anything, and without a transaction
 * around the whole sequence a mid-way failure left the user marked done with
 * nothing awarded and no way to retry.
 *
 * Callers that use this directly own the `publishLastActive` call — the service
 * worker's reminder state still needs updating, it just cannot happen inside
 * the transaction.
 */
export async function applyStudySession(
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
