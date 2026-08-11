import type { QuizAnswer } from "../db/schema";

/**
 * Confidence calibration: are you right as often as you think you are?
 *
 * Every answer already records a 1-5 confidence rating, and until now the only
 * thing reading it was a single "overconfidence detected" count on the review
 * page. Overconfidence is the classic way a well-prepared candidate fails this
 * exam — being wrong is survivable, but not knowing which answers to double
 * check is not — so it is worth measuring properly.
 */

export type ConfidenceLevel = 1 | 2 | 3 | 4 | 5;

/**
 * What each rating claims about accuracy.
 *
 * These are the midpoints of a "guessing → certain" scale, not measured
 * constants. 20% is the floor because a pure guess on four options is 25%, and
 * someone rating themselves a 1 is often actively misled rather than neutral.
 */
export const EXPECTED_ACCURACY: Record<ConfidenceLevel, number> = {
  1: 20,
  2: 40,
  3: 60,
  4: 80,
  5: 95,
};

/** Below these, the numbers are noise and must not be drawn as a chart. */
export const MIN_PER_BUCKET = 5;
export const MIN_RATED_TOTAL = 20;

export type CalibrationBucket = {
  confidence: ConfidenceLevel;
  count: number;
  correct: number;
  accuracyPct: number;
  expectedPct: number;
  /** Positive = more confident than accurate. */
  gap: number;
  /** False when this bucket alone is too thin to read anything into. */
  reliable: boolean;
};

export type Calibration =
  | { insufficient: true; rated: number; needed: number }
  | {
      insufficient: false;
      rated: number;
      buckets: CalibrationBucket[];
      /** Count-weighted mean gap across reliable buckets. Positive = overconfident. */
      index: number;
      verdict: "overconfident" | "underconfident" | "well-calibrated";
    };

const LEVELS: ConfidenceLevel[] = [1, 2, 3, 4, 5];

/** Beyond this the gap is a real pattern rather than ordinary variance. */
const VERDICT_THRESHOLD = 10;

/**
 * Accuracy per stated confidence level.
 *
 * Unrated answers are excluded rather than treated as a middling 3 — the user
 * declined to make a claim, and inventing one for them would blur the very
 * thing being measured.
 */
export function calibrationCurve(answers: readonly QuizAnswer[]): Calibration {
  const rated = answers.filter((a) => a.confidence !== null);
  if (rated.length < MIN_RATED_TOTAL) {
    return { insufficient: true, rated: rated.length, needed: MIN_RATED_TOTAL };
  }

  const buckets: CalibrationBucket[] = LEVELS.map((level) => {
    const mine = rated.filter((a) => a.confidence === level);
    const correct = mine.filter((a) => a.correct).length;
    const accuracyPct = mine.length === 0 ? 0 : Math.round((correct / mine.length) * 100);
    const expectedPct = EXPECTED_ACCURACY[level];
    return {
      confidence: level,
      count: mine.length,
      correct,
      accuracyPct,
      expectedPct,
      gap: mine.length === 0 ? 0 : expectedPct - accuracyPct,
      reliable: mine.length >= MIN_PER_BUCKET,
    };
  });

  const usable = buckets.filter((b) => b.reliable);
  if (usable.length === 0) {
    return { insufficient: true, rated: rated.length, needed: MIN_RATED_TOTAL };
  }

  // Weighted by count: a bucket with 50 answers should move the index more than
  // one with 6.
  const totalWeight = usable.reduce((s, b) => s + b.count, 0);
  const index = Math.round(usable.reduce((s, b) => s + b.gap * b.count, 0) / totalWeight);

  return {
    insufficient: false,
    rated: rated.length,
    buckets,
    index,
    verdict:
      index > VERDICT_THRESHOLD
        ? "overconfident"
        : index < -VERDICT_THRESHOLD
          ? "underconfident"
          : "well-calibrated",
  };
}

/**
 * The single most actionable number: how often a "confident" answer was wrong.
 *
 * Separate from the index because it needs no scale to interpret — "you were
 * sure and wrong 9 times" lands where "+14 calibration gap" does not.
 */
export function confidentMisses(answers: readonly QuizAnswer[]): {
  confident: number;
  wrong: number;
  pct: number;
} {
  const confident = answers.filter((a) => a.confidence !== null && a.confidence >= 4);
  const wrong = confident.filter((a) => !a.correct).length;
  return {
    confident: confident.length,
    wrong,
    pct: confident.length === 0 ? 0 : Math.round((wrong / confident.length) * 100),
  };
}
