import type { QuizMode } from "./scoring";

/**
 * Every XP award in the app, in one place.
 *
 * These were three one-line expressions buried in three components, so the
 * relative worth of a quiz, a flashcard and a vault drill could only be
 * compared by opening three files. None was tested.
 */

/**
 * Flat bonus per quiz mode, on top of the accuracy component.
 *
 * A misses run pays more than a domain drill of the same length. Retrying what
 * you got wrong is less pleasant than drilling what you already know, and it is
 * the behaviour most worth reinforcing.
 */
export const QUIZ_MODE_BONUS: Record<QuizMode, number> = {
  full: 200,
  mixed: 50,
  domain: 25,
  misses: 30,
};

/**
 * Quiz XP: two points per percentage point, plus the mode bonus.
 *
 * A scored-zero run still pays the bonus. That is intentional — finishing a
 * 150-question exam is the behaviour worth reinforcing, and a wrong answer has
 * already cost the user the score.
 */
export function quizXp(scorePct: number, mode: QuizMode): number {
  return Math.round(scorePct * 2) + QUIZ_MODE_BONUS[mode];
}

/**
 * Flashcard XP, by SM-2 grade. Recalling at all pays more than failing, but
 * failing still pays: the alternative is an incentive to grade yourself
 * generously, which corrupts the scheduling the whole deck depends on.
 */
export function flashcardXp(quality: number): number {
  return quality >= 3 ? 5 : 2;
}

/** Vault quick-test XP: a flat entry plus up to 10 for accuracy. */
export function quickTestXp(scorePct: number): number {
  return 10 + Math.round(scorePct / 10);
}
