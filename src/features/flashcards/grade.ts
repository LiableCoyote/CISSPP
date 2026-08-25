import { db } from "../../db/schema";
import { applyStudySession } from "../../lib/session";
import { flashcardXp } from "../../lib/rewards";
import { sm2, nextReviewDate } from "./srs";

/**
 * Grading a flashcard: the schedule, the study log and the XP, in one
 * transaction and at most once per card per session.
 *
 * `grade()` in ReviewSession awaited four database round-trips before resetting
 * any state, with the keyboard handler still registered, `revealed` still true,
 * and `card` taken from a live query that had not updated yet. Two quick presses
 * of "3" — or a double-tap on the Good button — therefore graded the same card
 * twice: `sm2()` ran twice from the *same* starting values, so `dueAt` was
 * pushed out further than the user's answer earned, XP was awarded twice, and
 * `flashcardsReviewed` double-counted, inflating the daily figure behind the
 * flashcard-100 and flashcard-500 badges and the heatmap.
 *
 * The file already noted that "keyboard grading can fire faster than
 * refreshProfile settles" — the speed was known and the XP read was fixed, but
 * the double-grade was not.
 *
 * There was also no try/catch on the path at all, so a failure part-way left the
 * schedule moved with no XP and no log, said nothing, and skipped the state
 * reset — leaving the answer on screen inviting exactly that second tap.
 *
 * Kept beside the feature rather than in src/lib because it uses ./srs, and a
 * lib reaching back into a feature is the wrong direction.
 * src/features/vault/quickTest.ts is the existing precedent.
 *
 * Throws on failure; the caller reports. Same split as src/lib/awards.ts.
 */

type Quality = 0 | 1 | 3 | 4;

export type GradeOutcome = "graded" | "already" | "missing";

export async function gradeCard(
  cardId: string,
  quality: Quality,
  sessionStart: string,
): Promise<GradeOutcome> {
  let outcome: GradeOutcome = "graded";

  await db.transaction("rw", [db.flashcards, db.studyLog, db.profile], async () => {
    // Read fresh. The caller holds a live-query snapshot, which is exactly what
    // is stale when a second grade arrives before the query has caught up.
    const card = await db.flashcards.get(cardId);
    if (!card) {
      outcome = "missing";
      return;
    }

    // The idempotence key, and it needs no schema change: sessionStart is frozen
    // when the session opens, grading always stamps lastReviewedAt, and a graded
    // card's dueAt moves into the future — so it can never legitimately come
    // round twice within one session. A card reviewed on a previous day has an
    // older stamp and grades normally.
    if (card.lastReviewedAt && card.lastReviewedAt >= sessionStart) {
      outcome = "already";
      return;
    }

    const now = new Date();
    const next = sm2(
      { ease: card.ease, interval: card.interval, reps: card.reps, lapses: card.lapses },
      quality,
    );
    await db.flashcards.update(cardId, {
      ease: next.ease,
      interval: next.interval,
      reps: next.reps,
      lapses: next.lapses,
      dueAt: nextReviewDate(now, next.interval).toISOString(),
      lastReviewedAt: now.toISOString(),
    });

    // The Dexie-only half of the session log. publishLastActive is a Cache API
    // write and belongs to the caller, outside this transaction.
    const profile = await db.profile.get(1);
    if (profile) {
      const streakPatch = await applyStudySession(profile, {
        minutes: 1,
        flashcardsReviewed: 1,
      });
      // Re-read: applyStudySession does not touch the profile row, but the XP
      // total must come from storage rather than the copy read above, so an
      // achievement unlocking alongside this is not overwritten.
      const fresh = await db.profile.get(1);
      if (fresh) {
        await db.profile.update(1, {
          ...streakPatch,
          xp: fresh.xp + flashcardXp(quality),
        });
      }
    }
  });

  return outcome;
}
