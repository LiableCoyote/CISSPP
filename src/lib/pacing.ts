import type { QuizAnswer } from "../db/schema";
import { MODE_LIMITS, MODE_SECONDS } from "./scoring";

/**
 * Time-per-question analysis, from the `timeTakenMs` already recorded on every
 * answer. Until now it fed only the speed-reader nudge.
 *
 * The real exam gives 150 questions in 3 hours. Whether you fit in that budget
 * is a fact about your habits that no amount of domain knowledge fixes on the
 * day, so it is worth knowing well before it.
 */

/** Seconds per question the real exam allows. */
export const EXAM_BUDGET_SECONDS = MODE_SECONDS.full / MODE_LIMITS.full;

/**
 * Answers longer than this are treated as "walked away", not as thinking.
 *
 * Without a cap a single question left open over lunch dominates any mean. The
 * median already resists that, but the cap keeps the mean and the slow-count
 * honest too.
 */
export const ABANDONED_MS = 10 * 60 * 1000;

export type PacingStats = {
  /** Answers that contributed, after discarding abandoned ones. */
  counted: number;
  discarded: number;
  medianSeconds: number;
  meanSeconds: number;
  /** Median seconds among answers that were right / wrong. 0 when none. */
  medianCorrectSeconds: number;
  medianIncorrectSeconds: number;
  /** Extrapolated full-exam minutes at the median pace. */
  projectedExamMinutes: number;
  /** True when that projection exceeds the 180-minute limit. */
  overBudget: boolean;
  /** Wrong answers given faster than half the budget — the rushing signal. */
  rushedMisses: number;
};

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const toSeconds = (ms: number) => Math.round((ms / 1000) * 10) / 10;

/**
 * Pace summary.
 *
 * Reports the **median**, not the mean, as the headline: question times are
 * heavily right-skewed — most answers take under a minute, a few take many —
 * and a mean would describe an experience the user never actually has.
 */
export function pacingStats(answers: readonly QuizAnswer[]): PacingStats {
  // A zero means the question timer never started, not an instant answer.
  const usable = answers.filter((a) => a.timeTakenMs > 0);
  const counted = usable.filter((a) => a.timeTakenMs <= ABANDONED_MS);
  const times = counted.map((a) => a.timeTakenMs);

  const medianMs = median(times);
  const medianSeconds = toSeconds(medianMs);
  const projectedExamMinutes =
    medianMs === 0 ? 0 : Math.round((MODE_LIMITS.full * (medianMs / 1000)) / 60);

  return {
    counted: counted.length,
    discarded: usable.length - counted.length,
    medianSeconds,
    meanSeconds: times.length === 0 ? 0 : toSeconds(times.reduce((s, t) => s + t, 0) / times.length),
    medianCorrectSeconds: toSeconds(median(counted.filter((a) => a.correct).map((a) => a.timeTakenMs))),
    medianIncorrectSeconds: toSeconds(
      median(counted.filter((a) => !a.correct).map((a) => a.timeTakenMs)),
    ),
    projectedExamMinutes,
    overBudget: projectedExamMinutes > MODE_SECONDS.full / 60,
    rushedMisses: counted.filter(
      (a) => !a.correct && a.timeTakenMs < (EXAM_BUDGET_SECONDS / 2) * 1000,
    ).length,
  };
}

/**
 * One sentence naming the pattern, or null when there is nothing to say.
 *
 * The interesting cases are not "fast" or "slow" on their own but the pairing
 * with accuracy: fast-and-wrong is a rushing problem, slow-and-right is a
 * timing problem, and they need opposite advice.
 */
export function describePacing(stats: PacingStats, minAnswers = 20): string | null {
  if (stats.counted < minAnswers) return null;

  const { medianCorrectSeconds: right, medianIncorrectSeconds: wrong } = stats;

  if (stats.overBudget) {
    return `At ${stats.medianSeconds}s a question you'd need about ${stats.projectedExamMinutes} minutes for 150 — the exam gives you 180. Practise deciding and committing.`;
  }
  // Meaningfully faster on the ones you get wrong: not thinking long enough.
  if (wrong > 0 && right > 0 && wrong < right * 0.7) {
    return `Your wrong answers take ${wrong}s against ${right}s for your right ones. You're deciding fastest exactly where you're least sure.`;
  }
  if (stats.rushedMisses >= 5) {
    return `${stats.rushedMisses} misses came in under ${Math.round(EXAM_BUDGET_SECONDS / 2)}s. Read the full stem before picking.`;
  }
  return `Median ${stats.medianSeconds}s a question — about ${stats.projectedExamMinutes} minutes for a full 150, inside the 180 you get.`;
}
