import { db, type Question, type QuizAnswer, type QuizAttempt } from "../db/schema";
import { applyReview, gradeFromOutcome, newReview } from "./questionSrs";
import { cisoCounterPatch } from "./scoring";

/**
 * The writes behind answering and finishing a quiz.
 *
 * `submit()` in QuizSessionPage used to update React state *before* awaiting an
 * unguarded `db.answers.add`:
 *
 *     setAnswers((a) => [...a, answer]);
 *     await db.answers.add(answer);
 *
 * A failed write therefore skipped `setSubmitted(true)`, leaving the button
 * still reading "Submit & Lock" with nothing said — an unhandled rejection in
 * an onClick. The obvious response is to tap again, which appended a *second*
 * copy of the answer to the array `finalize()` scores from, inflating the
 * `score` and `scorePct` stored on the attempt. `db.answers` kept one row,
 * because the id is derived from the attempt and question, so the corruption
 * was invisible in the data and showed up only as a number that was too high —
 * feeding readiness, calibration, mastery and the boss badges from there.
 *
 * The handler also did two further writes, the SM-2 reschedule and the CISO
 * counter patch, each able to fail on its own and leave the three out of step.
 *
 * Extracted here so the rollback and the idempotence can be asserted: the suite
 * runs on fake-indexeddb with no DOM, so anything left in a component is only
 * ever checkable by hand.
 *
 * Both functions throw on failure. Reporting is the caller's job, following the
 * same split as src/lib/awards.ts.
 */

export type RecordOutcome = "recorded" | "already";

/**
 * Records one answer, its spaced-repetition reschedule and its CISO counters,
 * in a single transaction.
 *
 * The existing-answer check is the important part, and it has to be inside the
 * transaction. Without it a retry would apply the SM-2 grade a second time and
 * increment the counters twice — quietly degrading exactly the signals this app
 * exists to produce, in a way no error would ever reveal.
 */
export async function recordAnswer(
  answer: QuizAnswer,
  question: Question,
): Promise<RecordOutcome> {
  let outcome: RecordOutcome = "recorded";
  await db.transaction("rw", [db.answers, db.questionReviews, db.profile], async () => {
    if (await db.answers.get(answer.id)) {
      outcome = "already";
      return;
    }
    await db.answers.put(answer);

    // A first miss earns a row due immediately; every later encounter — right
    // or wrong — reschedules through SM-2, so a question answered correctly
    // twice drifts out of the queue on its own and a repeat miss comes back
    // tomorrow rather than in the same sitting.
    //
    // A correct answer on a question that was never missed creates nothing: the
    // queue is for gaps, not for everything ever seen.
    const review = await db.questionReviews.get(answer.questionId);
    if (review) {
      const grade = gradeFromOutcome(answer.correct, answer.timeTakenMs, answer.confidence);
      await db.questionReviews.put(applyReview(review, grade));
    } else if (!answer.correct) {
      await db.questionReviews.put(newReview(answer.questionId, question.domainId));
    }

    const fresh = await db.profile.get(1);
    if (fresh) {
      const patch = cisoCounterPatch(fresh, {
        isMindsetHeavy: !!question.isMindsetHeavy,
        correct: answer.correct,
        technician: answer.flaggedMindset,
        speedy: answer.flaggedSpeed,
      });
      if (Object.keys(patch).length > 0) await db.profile.update(1, patch);
    }
  });
  return outcome;
}

export type FinalizeOutcome = "saved" | "already";

/**
 * Stores the finished attempt.
 *
 * Idempotent because two callers race for it: the last question's "Finish" and
 * the clock reaching zero. The timeout effect also depends on `finalize`, which
 * React rebuilds whenever the answers change, so it can fire more than once on
 * its own. `add` threw ConstraintError in all of those cases; `put` does not,
 * and the guard keeps the first stored result rather than overwriting it with a
 * second pass.
 */
export async function finalizeAttempt(attempt: QuizAttempt): Promise<FinalizeOutcome> {
  let outcome: FinalizeOutcome = "saved";
  await db.transaction("rw", db.attempts, async () => {
    const existing = await db.attempts.get(attempt.id);
    if (existing?.finishedAt) {
      outcome = "already";
      return;
    }
    await db.attempts.put(attempt);
  });
  return outcome;
}
