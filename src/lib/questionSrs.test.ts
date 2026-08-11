import { describe, it, expect } from "vitest";
import type { QuestionReview } from "../db/schema";
import { newReview, gradeFromOutcome, applyReview, dueReviews, countDue } from "./questionSrs";

const NOW = new Date("2026-03-10T12:00:00.000Z");

function review(over: Partial<QuestionReview> = {}): QuestionReview {
  return {
    questionId: "q-1",
    domainId: 1,
    ease: 2.5,
    interval: 0,
    reps: 0,
    lapses: 1,
    dueAt: NOW.toISOString(),
    lastReviewedAt: null,
    timesMissed: 1,
    firstMissedAt: NOW.toISOString(),
    ...over,
  };
}

describe("newReview", () => {
  it("is due immediately — an unrevisited miss is a gap right now", () => {
    const r = newReview("q-9", 3, NOW);
    expect(r.dueAt).toBe(NOW.toISOString());
    expect(r.questionId).toBe("q-9");
    expect(r.domainId).toBe(3);
    expect(r.timesMissed).toBe(1);
    expect(r.lastReviewedAt).toBeNull();
  });
});

describe("gradeFromOutcome", () => {
  // A wrong answer must never grade at or above SM-2's passing threshold,
  // otherwise a miss would push the question further away instead of closer.
  it("grades every wrong answer below the passing threshold", () => {
    for (const c of [null, 1, 2, 3, 4, 5] as const) {
      expect(gradeFromOutcome(false, 5_000, c)).toBeLessThan(3);
    }
  });

  it("punishes a confident wrong answer harder than a hesitant one", () => {
    expect(gradeFromOutcome(false, 5_000, 5)).toBe(0);
    expect(gradeFromOutcome(false, 5_000, 4)).toBe(0);
    expect(gradeFromOutcome(false, 5_000, 2)).toBe(1);
    expect(gradeFromOutcome(false, 5_000, null)).toBe(1);
  });

  it("rewards quick and confident with the top grade", () => {
    expect(gradeFromOutcome(true, 10_000, 5)).toBe(4);
    expect(gradeFromOutcome(true, 10_000, null)).toBe(4);
  });

  it("gives a plain pass when slow or unsure", () => {
    expect(gradeFromOutcome(true, 120_000, 5)).toBe(3);
    expect(gradeFromOutcome(true, 10_000, 2)).toBe(3);
  });

  // timeTakenMs is 0 when the question timer never started; treating that as
  // instant would hand out a 4 for free.
  it("does not treat a zero time as quick", () => {
    expect(gradeFromOutcome(true, 0, 5)).toBe(3);
  });

  it("never returns 2 — it would be indistinguishable from a wrong answer", () => {
    const grades = new Set<number>();
    for (const correct of [true, false]) {
      for (const t of [0, 5_000, 200_000]) {
        for (const c of [null, 1, 3, 5] as const) grades.add(gradeFromOutcome(correct, t, c));
      }
    }
    expect(grades.has(2)).toBe(false);
  });
});

describe("applyReview", () => {
  it("pushes a passed question into the future and stamps the review", () => {
    const out = applyReview(review(), 3, NOW);
    expect(out.interval).toBeGreaterThanOrEqual(1);
    expect(out.dueAt > NOW.toISOString()).toBe(true);
    expect(out.lastReviewedAt).toBe(NOW.toISOString());
    expect(out.reps).toBe(1);
  });

  it("grows the interval across successive passes", () => {
    let r = review();
    const intervals: number[] = [];
    for (let i = 0; i < 4; i++) {
      r = applyReview(r, 4, NOW);
      intervals.push(r.interval);
    }
    // Strictly increasing — the whole point of the schedule.
    expect(intervals).toEqual([...intervals].sort((a, b) => a - b));
    expect(intervals[3]).toBeGreaterThan(intervals[0]);
  });

  it("counts a lapse and a miss when failed, and comes back soon", () => {
    const out = applyReview(review({ reps: 3, interval: 20 }), 1, NOW);
    expect(out.lapses).toBe(2);
    expect(out.timesMissed).toBe(2);
    expect(out.reps).toBe(0);
    expect(out.interval).toBe(1);
  });

  // A repeat miss must not land back in the same sitting, or the session loops.
  it("reschedules a repeat miss to a later day, not to now", () => {
    const out = applyReview(review(), 0, NOW);
    expect(out.dueAt > NOW.toISOString()).toBe(true);
  });

  it("does not inflate timesMissed on a pass", () => {
    expect(applyReview(review({ timesMissed: 4 }), 4, NOW).timesMissed).toBe(4);
  });

  it("keeps identity fields intact", () => {
    const out = applyReview(review({ firstMissedAt: "2026-01-01T00:00:00.000Z" }), 3, NOW);
    expect(out.questionId).toBe("q-1");
    expect(out.firstMissedAt).toBe("2026-01-01T00:00:00.000Z");
  });
});

describe("dueReviews", () => {
  const past = "2026-03-01T00:00:00.000Z";
  const future = "2026-04-01T00:00:00.000Z";

  it("excludes anything not yet due", () => {
    const rows = [
      review({ questionId: "a", dueAt: past }),
      review({ questionId: "b", dueAt: future }),
    ];
    expect(dueReviews(rows, NOW).map((r) => r.questionId)).toEqual(["a"]);
  });

  it("includes a row due exactly now", () => {
    const rows = [review({ questionId: "a", dueAt: NOW.toISOString() })];
    expect(dueReviews(rows, NOW)).toHaveLength(1);
  });

  // With more due than a session holds, the repeatedly-missed ones earn the
  // limited slots.
  it("orders hardest first", () => {
    const rows = [
      review({ questionId: "easy", dueAt: past, timesMissed: 1 }),
      review({ questionId: "hard", dueAt: past, timesMissed: 5 }),
      review({ questionId: "mid", dueAt: past, timesMissed: 3 }),
    ];
    expect(dueReviews(rows, NOW).map((r) => r.questionId)).toEqual(["hard", "mid", "easy"]);
  });

  it("breaks ties on the longest overdue", () => {
    const rows = [
      review({ questionId: "recent", dueAt: "2026-03-09T00:00:00.000Z", timesMissed: 2 }),
      review({ questionId: "stale", dueAt: "2026-01-01T00:00:00.000Z", timesMissed: 2 }),
    ];
    expect(dueReviews(rows, NOW).map((r) => r.questionId)).toEqual(["stale", "recent"]);
  });

  it("applies the limit after ordering, so the hardest survive the cut", () => {
    const rows = [
      review({ questionId: "a", dueAt: past, timesMissed: 1 }),
      review({ questionId: "b", dueAt: past, timesMissed: 9 }),
      review({ questionId: "c", dueAt: past, timesMissed: 5 }),
    ];
    expect(dueReviews(rows, NOW, 2).map((r) => r.questionId)).toEqual(["b", "c"]);
  });

  it("returns everything when unlimited", () => {
    const rows = Array.from({ length: 30 }, (_, i) =>
      review({ questionId: `q${i}`, dueAt: past }),
    );
    expect(dueReviews(rows, NOW)).toHaveLength(30);
  });

  it("is empty rather than throwing with no rows", () => {
    expect(dueReviews([], NOW)).toEqual([]);
  });
});

describe("countDue", () => {
  it("counts only what is due", () => {
    const rows = [
      review({ questionId: "a", dueAt: "2026-03-01T00:00:00.000Z" }),
      review({ questionId: "b", dueAt: "2026-04-01T00:00:00.000Z" }),
      review({ questionId: "c", dueAt: "2026-03-02T00:00:00.000Z" }),
    ];
    expect(countDue(rows, NOW)).toBe(2);
  });

  it("agrees with dueReviews", () => {
    const rows = [
      review({ questionId: "a", dueAt: "2026-03-01T00:00:00.000Z" }),
      review({ questionId: "b", dueAt: "2026-04-01T00:00:00.000Z" }),
    ];
    expect(countDue(rows, NOW)).toBe(dueReviews(rows, NOW).length);
  });

  it("is zero with no rows", () => {
    expect(countDue([], NOW)).toBe(0);
  });
});

// The loop the feature exists to close: miss a question, retry it correctly
// twice, and it should stop appearing.
describe("the retry lifecycle", () => {
  it("takes a missed question out of the queue after consistent passes", () => {
    let r = newReview("q-1", 1, NOW);
    expect(countDue([r], NOW)).toBe(1);

    r = applyReview(r, gradeFromOutcome(true, 10_000, 5), NOW);
    const dayAfter = new Date(NOW.getTime() + 36 * 60 * 60 * 1000);
    expect(countDue([r], NOW)).toBe(0);

    r = applyReview(r, gradeFromOutcome(true, 10_000, 5), dayAfter);
    // Comfortably beyond a couple of days now.
    expect(countDue([r], new Date(dayAfter.getTime() + 2 * 24 * 60 * 60 * 1000))).toBe(0);
    expect(r.interval).toBeGreaterThan(1);
  });

  it("keeps a repeatedly-missed question coming back", () => {
    let r = newReview("q-1", 1, NOW);
    for (let i = 0; i < 3; i++) {
      const nextDay = new Date(NOW.getTime() + (i + 1) * 24 * 60 * 60 * 1000);
      r = applyReview(r, gradeFromOutcome(false, 5_000, 5), nextDay);
      // Always back within a day of being failed.
      expect(r.interval).toBe(1);
    }
    expect(r.timesMissed).toBe(4);
    expect(r.lapses).toBe(4);
  });
});
