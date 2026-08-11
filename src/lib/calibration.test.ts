import { describe, it, expect } from "vitest";
import type { QuizAnswer } from "../db/schema";
import {
  calibrationCurve,
  confidentMisses,
  EXPECTED_ACCURACY,
  MIN_RATED_TOTAL,
  MIN_PER_BUCKET,
} from "./calibration";

let seq = 0;
function answer(
  confidence: QuizAnswer["confidence"],
  correct: boolean,
  over: Partial<QuizAnswer> = {},
): QuizAnswer {
  return {
    id: `a-${seq++}`,
    attemptId: "att-1",
    questionId: `q-${seq}`,
    pickedIndex: 0,
    correct,
    timeTakenMs: 30_000,
    flaggedMindset: false,
    flaggedSpeed: false,
    missCategory: null,
    confidence,
    ...over,
  };
}

/** `n` answers at one confidence level, `rightCount` of them correct. */
function bucket(confidence: 1 | 2 | 3 | 4 | 5, n: number, rightCount: number): QuizAnswer[] {
  return Array.from({ length: n }, (_, i) => answer(confidence, i < rightCount));
}

describe("the minimum-sample guard", () => {
  // A confident-looking calibration chart drawn from three answers is worse
  // than no chart — it invites a study decision the data cannot support.
  it("refuses to report below the overall threshold", () => {
    const result = calibrationCurve(bucket(5, MIN_RATED_TOTAL - 1, 10));
    expect(result.insufficient).toBe(true);
    if (result.insufficient) {
      expect(result.rated).toBe(MIN_RATED_TOTAL - 1);
      expect(result.needed).toBe(MIN_RATED_TOTAL);
    }
  });

  it("reports once the threshold is met", () => {
    expect(calibrationCurve(bucket(5, MIN_RATED_TOTAL, 10)).insufficient).toBe(false);
  });

  it("refuses when enough answers exist but every bucket is too thin", () => {
    // 25 answers spread so no single level reaches MIN_PER_BUCKET.
    const thin = [
      ...bucket(1, 4, 2),
      ...bucket(2, 4, 2),
      ...bucket(3, 4, 2),
      ...bucket(4, 4, 2),
      ...bucket(5, 4, 2),
    ];
    expect(thin.length).toBeGreaterThanOrEqual(MIN_RATED_TOTAL);
    expect(calibrationCurve(thin).insufficient).toBe(true);
  });

  it("ignores unrated answers rather than treating them as middling", () => {
    const answers = [...bucket(5, 10, 9), ...Array.from({ length: 50 }, () => answer(null, false))];
    const result = calibrationCurve(answers);
    // 10 rated is under the threshold; the 50 unrated must not rescue it.
    expect(result.insufficient).toBe(true);
    if (result.insufficient) expect(result.rated).toBe(10);
  });
});

describe("calibrationCurve", () => {
  it("computes accuracy per confidence level", () => {
    const result = calibrationCurve([...bucket(5, 10, 5), ...bucket(2, 10, 8)]);
    expect(result.insufficient).toBe(false);
    if (result.insufficient) return;

    const five = result.buckets.find((b) => b.confidence === 5)!;
    expect(five.count).toBe(10);
    expect(five.correct).toBe(5);
    expect(five.accuracyPct).toBe(50);
    expect(five.expectedPct).toBe(EXPECTED_ACCURACY[5]);
    expect(five.gap).toBe(EXPECTED_ACCURACY[5] - 50);
  });

  it("returns a bucket for every level, marking empty ones unreliable", () => {
    const result = calibrationCurve(bucket(3, 25, 15));
    if (result.insufficient) throw new Error("expected a report");
    expect(result.buckets.map((b) => b.confidence)).toEqual([1, 2, 3, 4, 5]);
    expect(result.buckets.filter((b) => b.reliable)).toHaveLength(1);
    expect(result.buckets.find((b) => b.confidence === 1)!.count).toBe(0);
  });

  it("marks a bucket unreliable just under the per-bucket floor", () => {
    const result = calibrationCurve([
      ...bucket(5, 20, 19),
      ...bucket(1, MIN_PER_BUCKET - 1, 0),
    ]);
    if (result.insufficient) throw new Error("expected a report");
    expect(result.buckets.find((b) => b.confidence === 1)!.reliable).toBe(false);
    expect(result.buckets.find((b) => b.confidence === 5)!.reliable).toBe(true);
  });

  // The headline case: sure, and wrong half the time.
  it("calls out overconfidence", () => {
    const result = calibrationCurve(bucket(5, 30, 12)); // claims 95%, delivers 40%
    if (result.insufficient) throw new Error("expected a report");
    expect(result.verdict).toBe("overconfident");
    expect(result.index).toBeGreaterThan(0);
  });

  it("calls out underconfidence", () => {
    const result = calibrationCurve(bucket(1, 30, 27)); // claims 20%, delivers 90%
    if (result.insufficient) throw new Error("expected a report");
    expect(result.verdict).toBe("underconfident");
    expect(result.index).toBeLessThan(0);
  });

  it("calls a matching curve well-calibrated", () => {
    // Each level delivers roughly what it claims.
    const result = calibrationCurve([
      ...bucket(1, 10, 2),
      ...bucket(3, 10, 6),
      ...bucket(5, 20, 19),
    ]);
    if (result.insufficient) throw new Error("expected a report");
    expect(result.verdict).toBe("well-calibrated");
    expect(Math.abs(result.index)).toBeLessThanOrEqual(10);
  });

  it("weights the index by bucket size", () => {
    // A big well-calibrated bucket should outweigh a small skewed one.
    const result = calibrationCurve([...bucket(5, 60, 57), ...bucket(1, 6, 6)]);
    if (result.insufficient) throw new Error("expected a report");
    expect(result.verdict).toBe("well-calibrated");
  });

  it("excludes unreliable buckets from the index", () => {
    const skewedButThin = [...bucket(5, 30, 29), ...bucket(1, 2, 2)];
    const withoutThin = bucket(5, 30, 29);
    const a = calibrationCurve(skewedButThin);
    const b = calibrationCurve(withoutThin);
    if (a.insufficient || b.insufficient) throw new Error("expected reports");
    expect(a.index).toBe(b.index);
  });
});

describe("confidentMisses", () => {
  it("counts wrong answers among the 4s and 5s", () => {
    const out = confidentMisses([
      ...bucket(5, 10, 7), // 3 wrong
      ...bucket(4, 10, 8), // 2 wrong
      ...bucket(2, 10, 0), // not confident, ignored
    ]);
    expect(out.confident).toBe(20);
    expect(out.wrong).toBe(5);
    expect(out.pct).toBe(25);
  });

  it("ignores unrated answers", () => {
    const out = confidentMisses([answer(null, false), answer(null, false), ...bucket(5, 4, 4)]);
    expect(out.confident).toBe(4);
    expect(out.wrong).toBe(0);
  });

  it("does not divide by zero with no confident answers", () => {
    expect(confidentMisses([answer(1, false), answer(null, false)])).toEqual({
      confident: 0,
      wrong: 0,
      pct: 0,
    });
  });

  it("is empty rather than throwing on no answers", () => {
    expect(confidentMisses([]).pct).toBe(0);
  });
});
