import { sm2, nextReviewDate, type SM2State } from "../features/flashcards/srs";
import type { DomainId, QuestionReview, QuizAnswer } from "../db/schema";

/**
 * Spaced repetition for questions the user has answered wrong.
 *
 * Deliberately built on the same `sm2` implementation the flashcard deck uses
 * (`src/features/flashcards/srs.ts`) rather than a second scheduler. Two
 * schedulers drifting apart would mean "due" meant different things on
 * different screens.
 *
 * Everything here is pure and takes its clock as a parameter, so the whole
 * module is testable in the node-only suite.
 */

/** A brand-new review row, scheduled due immediately. */
export function newReview(
  questionId: string,
  domainId: DomainId,
  now: Date = new Date(),
): QuestionReview {
  const iso = now.toISOString();
  return {
    questionId,
    domainId,
    ease: 2.5,
    interval: 0,
    reps: 0,
    lapses: 1,
    dueAt: iso,
    lastReviewedAt: null,
    timesMissed: 1,
    firstMissedAt: iso,
  };
}

/**
 * Maps a retry outcome onto an SM-2 quality.
 *
 * A flashcard is self-graded — the user says how well they recalled it. A
 * question retry is not: it is right or wrong, and pretending otherwise would
 * let someone inflate their own schedule. The remaining judgement is only about
 * *how* well it was answered, which confidence and speed already describe.
 *
 * Quality 2 is never returned: it sits on the failing side of SM-2's threshold
 * (< 3) and would be indistinguishable from a plain wrong answer.
 */
export function gradeFromOutcome(
  correct: boolean,
  timeTakenMs: number,
  confidence: QuizAnswer["confidence"],
  quickMs = 30_000,
): 0 | 1 | 3 | 4 {
  if (!correct) {
    // A confident wrong answer is a worse signal than a hesitant one: the user
    // does not merely lack the fact, they believe something false.
    return confidence !== null && confidence >= 4 ? 0 : 1;
  }
  const quick = timeTakenMs > 0 && timeTakenMs <= quickMs;
  const sure = confidence === null || confidence >= 4;
  return quick && sure ? 4 : 3;
}

/** Applies a graded retry, returning the rescheduled row. */
export function applyReview(
  review: QuestionReview,
  quality: 0 | 1 | 3 | 4,
  now: Date = new Date(),
): QuestionReview {
  const state: SM2State = {
    ease: review.ease,
    interval: review.interval,
    reps: review.reps,
    lapses: review.lapses,
  };
  const next = sm2(state, quality);
  return {
    ...review,
    ...next,
    dueAt: nextReviewDate(now, next.interval).toISOString(),
    lastReviewedAt: now.toISOString(),
    timesMissed: quality < 3 ? review.timesMissed + 1 : review.timesMissed,
  };
}

/**
 * Rows due at `now`, hardest first.
 *
 * Ordered by miss count before due date: with more due than a session can hold,
 * the questions missed repeatedly are the ones worth the limited slots. Ties
 * break on the longest-overdue.
 */
export function dueReviews(
  rows: readonly QuestionReview[],
  now: Date = new Date(),
  limit = Infinity,
): QuestionReview[] {
  const nowIso = now.toISOString();
  return rows
    .filter((r) => r.dueAt <= nowIso)
    .sort((a, b) => b.timesMissed - a.timesMissed || a.dueAt.localeCompare(b.dueAt))
    .slice(0, limit === Infinity ? undefined : limit);
}

/** How many rows are due — for the launcher badge, without loading them all. */
export function countDue(rows: readonly QuestionReview[], now: Date = new Date()): number {
  const nowIso = now.toISOString();
  return rows.reduce((n, r) => (r.dueAt <= nowIso ? n + 1 : n), 0);
}
