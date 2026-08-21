import { db, type Profile, type Quest, type QuizAttempt } from "../db/schema";
import { applyStudySession } from "./session";
import { quizXp } from "./rewards";

/**
 * The transactional half of "you finished something, here is your credit".
 *
 * Both award paths mark the thing done *before* crediting anything, which is
 * deliberate — the quiz review page is a bookmarkable URL, so claiming late let
 * people re-award by navigating back. What was missing is that nothing undid
 * the mark when the credit failed. There was no try/catch on either path, so a
 * failed studyLog write left the user marked done with no XP, no message, and
 * the re-entry guard blocking every retry. Finishing a 150-question exam and
 * losing it entirely was a handful of milliseconds of bad luck away.
 *
 * Wrapping each award in one Dexie transaction fixes that for free: IndexedDB
 * rolls the whole thing back, `claimedAt` and `completedAt` included, so the
 * retry the UI already offers actually works.
 *
 * Extracted here rather than left in the handlers so the rollback can be
 * asserted — the suite runs on fake-indexeddb with no DOM, so anything that
 * stays in a component is only ever verifiable by hand in a browser.
 *
 * Every read inside these transactions goes to the database, never to a React
 * snapshot: the re-entry guard and the XP arithmetic both need to see what is
 * actually stored, not what the page last painted.
 *
 * These throw on failure. Reporting is the caller's job, because only the
 * caller knows what to call the thing that failed.
 */

/** Whether the award actually happened, or had already been collected. */
export type AwardOutcome = "awarded" | "already";

export async function claimQuizAttempt(
  profile: Profile,
  attempt: QuizAttempt,
): Promise<AwardOutcome> {
  let outcome: AwardOutcome = "awarded";
  await db.transaction("rw", [db.attempts, db.profile, db.studyLog], async () => {
    const fresh = await db.attempts.get(attempt.id);
    if (fresh?.claimedAt) {
      outcome = "already";
      return;
    }
    await db.attempts.update(attempt.id, { claimedAt: new Date().toISOString() });
    const streakPatch = await applyStudySession(profile, {
      minutes: Math.max(1, Math.round(attempt.totalSeconds / 60)),
    });
    const p = await db.profile.get(1);
    if (p) {
      await db.profile.update(1, {
        ...streakPatch,
        xp: p.xp + quizXp(attempt.scorePct, attempt.mode),
      });
    }
  });
  return outcome;
}

export async function completeQuest(
  profile: Profile,
  quest: Quest,
  minutes: number,
): Promise<AwardOutcome> {
  let outcome: AwardOutcome = "awarded";
  await db.transaction("rw", [db.quests, db.profile, db.studyLog], async () => {
    const fresh = await db.quests.get(quest.id);
    if (fresh?.completedAt) {
      outcome = "already";
      return;
    }
    await db.quests.update(quest.id, { completedAt: new Date().toISOString() });
    const streakPatch = await applyStudySession(profile, {
      minutes,
      questsCompleted: 1,
    });
    const p = await db.profile.get(1);
    if (p) await db.profile.update(1, { ...streakPatch, xp: p.xp + quest.xp });
  });
  return outcome;
}

/**
 * Un-ticks a quest and takes the XP back.
 *
 * Reads the stored total rather than subtracting from a render snapshot, which
 * would restore a stale figure if anything had credited XP since the page
 * painted. The study log is deliberately left alone: the time was still spent,
 * and un-ticking a quest is not a claim that the day did not happen.
 */
export async function undoQuestCompletion(quest: Quest): Promise<AwardOutcome> {
  let outcome: AwardOutcome = "awarded";
  await db.transaction("rw", [db.quests, db.profile], async () => {
    const fresh = await db.quests.get(quest.id);
    if (!fresh?.completedAt) {
      outcome = "already";
      return;
    }
    await db.quests.update(quest.id, { completedAt: null });
    const p = await db.profile.get(1);
    if (p) await db.profile.update(1, { xp: Math.max(0, p.xp - quest.xp) });
  });
  return outcome;
}
