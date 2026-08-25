import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  db,
  type Profile,
  type Question,
  type QuizAnswer,
  type QuizAttempt,
} from "../db/schema";
import { recordAnswer, finalizeAttempt } from "./quizWrites";

function profile(over: Partial<Profile> = {}): Profile {
  return {
    id: 1,
    displayName: "T",
    examDate: null,
    dailyGoalMinutes: 120,
    startDate: new Date().toISOString(),
    xp: 0,
    streak: 0,
    longestStreak: 0,
    streakFreezesUsedThisWeek: 0,
    streakWeekKey: "",
    lastActiveDate: null,
    mindsetChoicesCorrect: 0,
    technicianMisses: 0,
    speedReaderMisses: 0,
    createdAt: new Date().toISOString(),
    ...over,
  };
}

function question(over: Partial<Question> = {}): Question {
  return {
    id: "d1-001",
    domainId: 1,
    prompt: "p",
    options: ["a", "b", "c", "d"],
    answerIndex: 0,
    explanation: "e",
    tags: [],
    isMindsetHeavy: false,
    ...over,
  };
}

function answer(over: Partial<QuizAnswer> = {}): QuizAnswer {
  return {
    id: "attempt-1-d1-001",
    attemptId: "attempt-1",
    questionId: "d1-001",
    pickedIndex: 0,
    correct: true,
    timeTakenMs: 45_000,
    flaggedMindset: false,
    flaggedSpeed: false,
    missCategory: null,
    confidence: 3,
    ...over,
  };
}

function attempt(over: Partial<QuizAttempt> = {}): QuizAttempt {
  const at = new Date().toISOString();
  return {
    id: "attempt-1",
    mode: "domain",
    domainId: 1,
    questionIds: ["d1-001"],
    startedAt: at,
    finishedAt: at,
    totalSeconds: 300,
    score: 1,
    scorePct: 100,
    passed: null,
    targetScorePct: null,
    ...over,
  };
}

/** Fails writes to one store and leaves the rest working. */
function breakStore(name: string) {
  const realAdd = IDBObjectStore.prototype.add;
  const realPut = IDBObjectStore.prototype.put;
  const guard = (fn: typeof realAdd) =>
    function (this: IDBObjectStore, ...args: unknown[]) {
      if (this.name === name) throw new Error("QuotaExceededError");
      return (fn as (...a: unknown[]) => IDBRequest).apply(this, args);
    } as typeof realAdd;
  IDBObjectStore.prototype.add = guard(realAdd);
  IDBObjectStore.prototype.put = guard(realPut);
  return () => {
    IDBObjectStore.prototype.add = realAdd;
    IDBObjectStore.prototype.put = realPut;
  };
}

beforeEach(async () => {
  await db.answers.clear();
  await db.questionReviews.clear();
  await db.profile.clear();
  await db.attempts.clear();
  await db.profile.put(profile());
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("recordAnswer", () => {
  it("stores the answer", async () => {
    expect(await recordAnswer(answer(), question())).toBe("recorded");
    expect(await db.answers.count()).toBe(1);
  });

  /**
   * The defect this module exists for. The handler updated React state before
   * this write and had no try/catch, so a failure left the question looking
   * unsubmitted — and the retry that invited appended the answer to the scoring
   * array a second time, inflating the score stored on the attempt while
   * db.answers still held one row.
   */
  it("leaves nothing behind when the write fails", async () => {
    const restore = breakStore("answers");
    await expect(recordAnswer(answer({ correct: false }), question())).rejects.toThrow();
    restore();

    expect(await db.answers.count()).toBe(0);
    expect(await db.questionReviews.count()).toBe(0);
    expect((await db.profile.get(1))?.technicianMisses).toBe(0);
  });

  it("rolls the answer back when a later write in the same transaction fails", async () => {
    const restore = breakStore("questionReviews");
    // A miss, so the SRS row is written — and fails.
    await expect(recordAnswer(answer({ correct: false }), question())).rejects.toThrow();
    restore();
    expect(await db.answers.count()).toBe(0);
  });

  // The guard that matters most: re-recording must not re-grade or re-count.
  it("is idempotent — a repeat applies the schedule and counters once", async () => {
    const a = answer({ correct: false, flaggedMindset: true, flaggedSpeed: true });
    const q = question({ isMindsetHeavy: true });

    expect(await recordAnswer(a, q)).toBe("recorded");
    const afterFirst = await db.questionReviews.get("d1-001");
    const profileAfterFirst = await db.profile.get(1);

    expect(await recordAnswer(a, q)).toBe("already");

    expect(await db.answers.count()).toBe(1);
    expect(await db.questionReviews.get("d1-001")).toEqual(afterFirst);
    expect(await db.profile.get(1)).toEqual(profileAfterFirst);
  });

  it("counts a technician pick and a speedy miss exactly once", async () => {
    const a = answer({ correct: false, flaggedMindset: true, flaggedSpeed: true });
    await recordAnswer(a, question());
    await recordAnswer(a, question());
    const p = await db.profile.get(1);
    expect(p?.technicianMisses).toBe(1);
    expect(p?.speedReaderMisses).toBe(1);
  });

  /* The SRS rules, unchanged by the move. */

  it("creates a review row on a first miss", async () => {
    await recordAnswer(answer({ correct: false }), question());
    const row = await db.questionReviews.get("d1-001");
    expect(row?.timesMissed).toBe(1);
    expect(row?.domainId).toBe(1);
  });

  // The queue is for gaps, not for everything ever seen.
  it("creates nothing for a correct answer on a question never missed", async () => {
    await recordAnswer(answer({ correct: true }), question());
    expect(await db.questionReviews.count()).toBe(0);
  });

  it("reschedules an existing row on a later encounter", async () => {
    await recordAnswer(answer({ correct: false }), question());
    const first = await db.questionReviews.get("d1-001");

    await recordAnswer(
      answer({ id: "attempt-2-d1-001", attemptId: "attempt-2", correct: true }),
      question(),
    );
    const second = await db.questionReviews.get("d1-001");

    expect(second?.reps).toBeGreaterThan(first!.reps);
    expect(second?.dueAt).not.toBe(first?.dueAt);
  });

  it("does not throw when there is no profile row", async () => {
    await db.profile.clear();
    await expect(recordAnswer(answer(), question())).resolves.toBe("recorded");
    expect(await db.answers.count()).toBe(1);
  });
});

describe("finalizeAttempt", () => {
  it("stores the attempt", async () => {
    expect(await finalizeAttempt(attempt())).toBe("saved");
    expect((await db.attempts.get("attempt-1"))?.scorePct).toBe(100);
  });

  // The clock and the last question both call this; add() threw on the second.
  it("is idempotent, keeping the first result", async () => {
    await finalizeAttempt(attempt({ scorePct: 80, score: 8 }));
    expect(await finalizeAttempt(attempt({ scorePct: 40, score: 4 }))).toBe("already");

    const stored = await db.attempts.get("attempt-1");
    expect(stored?.scorePct).toBe(80);
    expect(await db.attempts.count()).toBe(1);
  });

  it("survives being called twice at once", async () => {
    const results = await Promise.all([finalizeAttempt(attempt()), finalizeAttempt(attempt())]);
    expect(results.filter((r) => r === "saved")).toHaveLength(1);
    expect(await db.attempts.count()).toBe(1);
  });

  it("propagates a failure rather than pretending it saved", async () => {
    const restore = breakStore("attempts");
    await expect(finalizeAttempt(attempt())).rejects.toThrow();
    restore();
    expect(await db.attempts.count()).toBe(0);
  });

  // An unfinished row is a resumable attempt, not a completed one.
  it("overwrites a started-but-unfinished attempt", async () => {
    await db.attempts.put(attempt({ finishedAt: null, scorePct: 0 }));
    expect(await finalizeAttempt(attempt({ scorePct: 90 }))).toBe("saved");
    expect((await db.attempts.get("attempt-1"))?.scorePct).toBe(90);
  });
});
