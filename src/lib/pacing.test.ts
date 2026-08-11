import { describe, it, expect } from "vitest";
import type { QuizAnswer } from "../db/schema";
import { pacingStats, describePacing, EXAM_BUDGET_SECONDS, ABANDONED_MS } from "./pacing";

let seq = 0;
function answer(seconds: number, correct = true): QuizAnswer {
  return {
    id: `a-${seq++}`,
    attemptId: "att-1",
    questionId: `q-${seq}`,
    pickedIndex: 0,
    correct,
    timeTakenMs: seconds * 1000,
    flaggedMindset: false,
    flaggedSpeed: false,
    missCategory: null,
    confidence: null,
  };
}

const many = (n: number, seconds: number, correct = true) =>
  Array.from({ length: n }, () => answer(seconds, correct));

describe("the exam budget", () => {
  it("is 72 seconds — 150 questions in 3 hours", () => {
    expect(EXAM_BUDGET_SECONDS).toBe(72);
  });
});

describe("pacingStats", () => {
  it("reports the median as the headline, not the mean", () => {
    // Nine quick answers and one enormous outlier.
    const answers = [...many(9, 30), answer(500)];
    const stats = pacingStats(answers);
    expect(stats.medianSeconds).toBe(30);
    expect(stats.meanSeconds).toBeGreaterThan(60);
  });

  it("averages the middle pair on an even count", () => {
    expect(pacingStats([answer(10), answer(20), answer(30), answer(40)]).medianSeconds).toBe(25);
  });

  // A question left open over lunch is not thinking time.
  it("discards abandoned answers from every statistic", () => {
    const stats = pacingStats([...many(5, 40), answer(ABANDONED_MS / 1000 + 60)]);
    expect(stats.counted).toBe(5);
    expect(stats.discarded).toBe(1);
    expect(stats.medianSeconds).toBe(40);
    expect(stats.meanSeconds).toBe(40);
  });

  it("keeps an answer exactly at the abandonment cap", () => {
    const stats = pacingStats([answer(ABANDONED_MS / 1000)]);
    expect(stats.counted).toBe(1);
    expect(stats.discarded).toBe(0);
  });

  // timeTakenMs is 0 when the per-question timer never started.
  it("ignores zero times rather than counting them as instant", () => {
    const stats = pacingStats([answer(0), answer(0), ...many(3, 60)]);
    expect(stats.counted).toBe(3);
    expect(stats.medianSeconds).toBe(60);
  });

  it("projects a full exam from the median pace", () => {
    expect(pacingStats(many(10, 60)).projectedExamMinutes).toBe(150);
    expect(pacingStats(many(10, 72)).projectedExamMinutes).toBe(180);
  });

  it("flags going over the 180-minute limit, and not at exactly the limit", () => {
    expect(pacingStats(many(10, 72)).overBudget).toBe(false);
    expect(pacingStats(many(10, 90)).overBudget).toBe(true);
  });

  it("splits the median by correctness", () => {
    const stats = pacingStats([...many(5, 20, false), ...many(5, 80, true)]);
    expect(stats.medianIncorrectSeconds).toBe(20);
    expect(stats.medianCorrectSeconds).toBe(80);
  });

  it("counts misses answered in under half the budget", () => {
    const stats = pacingStats([
      ...many(4, 10, false), // rushed misses
      ...many(3, 60, false), // considered misses
      ...many(3, 10, true), // quick but right
    ]);
    expect(stats.rushedMisses).toBe(4);
  });

  it("returns zeroes rather than NaN with no answers", () => {
    const stats = pacingStats([]);
    expect(stats).toMatchObject({
      counted: 0,
      medianSeconds: 0,
      meanSeconds: 0,
      projectedExamMinutes: 0,
      overBudget: false,
    });
  });

  it("returns zero for a split with no answers on that side", () => {
    expect(pacingStats(many(5, 30, true)).medianIncorrectSeconds).toBe(0);
  });
});

describe("describePacing", () => {
  it("says nothing until there is enough data", () => {
    expect(describePacing(pacingStats(many(5, 30)))).toBeNull();
  });

  it("warns first when the projection blows the time limit", () => {
    const text = describePacing(pacingStats(many(30, 120, false)));
    expect(text).toMatch(/180/);
    expect(text).toMatch(/deciding and committing/i);
  });

  // The pairing that matters: fastest exactly where least sure.
  it("names the fast-and-wrong pattern", () => {
    const stats = pacingStats([...many(15, 15, false), ...many(15, 60, true)]);
    const text = describePacing(stats);
    expect(text).toMatch(/least sure/i);
  });

  it("falls through to a plain readout when the pace is healthy", () => {
    const text = describePacing(pacingStats(many(30, 50)));
    expect(text).toMatch(/Median 50s/);
    expect(text).toMatch(/inside the 180/);
  });

  it("respects a custom minimum", () => {
    expect(describePacing(pacingStats(many(6, 30)), 5)).not.toBeNull();
  });
});
