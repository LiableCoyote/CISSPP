import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { db, type Profile, type Quest, type QuizAttempt } from "../db/schema";
import { claimQuizAttempt, completeQuest, undoQuestCompletion } from "./awards";
import { quizXp } from "./rewards";

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

function attempt(over: Partial<QuizAttempt> = {}): QuizAttempt {
  const at = new Date().toISOString();
  return {
    id: "a1",
    mode: "full",
    domainId: null,
    questionIds: [],
    startedAt: at,
    finishedAt: at,
    totalSeconds: 3600,
    score: 120,
    scorePct: 80,
    passed: true,
    targetScorePct: 70,
    claimedAt: null,
    ...over,
  };
}

function quest(over: Partial<Quest> = {}): Quest {
  return {
    id: "q1",
    week: 1,
    day: 1,
    title: "Read chapter 1",
    description: "d",
    domainIds: [1],
    xp: 75,
    type: "read",
    completedAt: null,
    minutesLogged: 0,
    ...over,
  };
}

/**
 * Fails the study-log write and nothing else. That is the middle of the
 * sequence — after the claim is marked, before the XP lands — which is exactly
 * the window that used to leave the user marked done with nothing credited.
 */
function breakStudyLog() {
  const realAdd = IDBObjectStore.prototype.add;
  const realPut = IDBObjectStore.prototype.put;
  const guard = (fn: typeof realAdd) =>
    function (this: IDBObjectStore, ...args: unknown[]) {
      if (this.name === "studyLog") throw new Error("QuotaExceededError");
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
  await db.attempts.clear();
  await db.quests.clear();
  await db.profile.clear();
  await db.studyLog.clear();
  await db.profile.put(profile());
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("claimQuizAttempt", () => {
  it("marks the attempt claimed and credits the XP", async () => {
    const a = attempt();
    await db.attempts.add(a);

    expect(await claimQuizAttempt(profile(), a)).toBe("awarded");

    expect((await db.attempts.get("a1"))?.claimedAt).toBeTruthy();
    expect((await db.profile.get(1))?.xp).toBe(quizXp(a.scorePct, a.mode));
    expect(await db.studyLog.count()).toBe(1);
  });

  /**
   * The defect this file exists for. The claim used to be written first with no
   * transaction and no try/catch, so a failure here left the attempt claimed,
   * the XP uncredited, and the re-entry guard refusing to let the user try
   * again — a finished 150-question exam, gone.
   */
  it("rolls the claim back when the session write fails", async () => {
    const a = attempt();
    await db.attempts.add(a);
    const restore = breakStudyLog();

    await expect(claimQuizAttempt(profile(), a)).rejects.toThrow();
    restore();

    expect((await db.attempts.get("a1"))?.claimedAt).toBeFalsy();
    expect((await db.profile.get(1))?.xp).toBe(0);
    expect(await db.studyLog.count()).toBe(0);
  });

  it("and the retry then works, crediting exactly once", async () => {
    const a = attempt();
    await db.attempts.add(a);
    const restore = breakStudyLog();
    await expect(claimQuizAttempt(profile(), a)).rejects.toThrow();
    restore();

    expect(await claimQuizAttempt(profile(), a)).toBe("awarded");
    expect((await db.profile.get(1))?.xp).toBe(quizXp(a.scorePct, a.mode));
  });

  it("refuses a second claim, reading the database rather than the caller's copy", async () => {
    const a = attempt();
    await db.attempts.add(a);
    await claimQuizAttempt(profile(), a);

    // `a` is the caller's stale snapshot, still showing claimedAt: null — the
    // shape a component would pass in from a render closure.
    expect(await claimQuizAttempt(profile(), a)).toBe("already");
    expect((await db.profile.get(1))?.xp).toBe(quizXp(a.scorePct, a.mode));
  });

  it("credits once when two claims race", async () => {
    const a = attempt();
    await db.attempts.add(a);

    const results = await Promise.all([
      claimQuizAttempt(profile(), a),
      claimQuizAttempt(profile(), a),
    ]);

    expect(results.filter((r) => r === "awarded")).toHaveLength(1);
    expect((await db.profile.get(1))?.xp).toBe(quizXp(a.scorePct, a.mode));
  });

  // The XP total comes from the stored row, not from the profile handed in, so
  // anything credited since that snapshot survives.
  it("adds to whatever is stored, not to the caller's snapshot", async () => {
    const a = attempt();
    await db.attempts.add(a);
    const stale = profile({ xp: 0 });
    await db.profile.update(1, { xp: 500 }); // e.g. a badge unlocked meanwhile

    await claimQuizAttempt(stale, a);
    expect((await db.profile.get(1))?.xp).toBe(500 + quizXp(a.scorePct, a.mode));
  });
});

describe("completeQuest", () => {
  it("ticks the quest and credits the XP", async () => {
    const q = quest();
    await db.quests.add(q);

    expect(await completeQuest(profile(), q, 20)).toBe("awarded");
    expect((await db.quests.get("q1"))?.completedAt).toBeTruthy();
    expect((await db.profile.get(1))?.xp).toBe(75);
  });

  it("rolls the tick back when the session write fails", async () => {
    const q = quest();
    await db.quests.add(q);
    const restore = breakStudyLog();

    await expect(completeQuest(profile(), q, 20)).rejects.toThrow();
    restore();

    expect((await db.quests.get("q1"))?.completedAt).toBeNull();
    expect((await db.profile.get(1))?.xp).toBe(0);
  });

  it("does not double-credit an already-completed quest", async () => {
    const q = quest();
    await db.quests.add(q);
    await completeQuest(profile(), q, 20);
    expect(await completeQuest(profile(), q, 20)).toBe("already");
    expect((await db.profile.get(1))?.xp).toBe(75);
  });
});

describe("undoQuestCompletion", () => {
  it("un-ticks and takes the XP back", async () => {
    const q = quest();
    await db.quests.add(q);
    await completeQuest(profile(), q, 20);

    expect(await undoQuestCompletion(q)).toBe("awarded");
    expect((await db.quests.get("q1"))?.completedAt).toBeNull();
    expect((await db.profile.get(1))?.xp).toBe(0);
  });

  // It used to subtract from the render snapshot, so XP credited between the
  // paint and the tap was wiped out along with the quest's own award.
  it("subtracts from the stored total, not a stale snapshot", async () => {
    const q = quest();
    await db.quests.add(q);
    await completeQuest(profile(), q, 20);
    await db.profile.update(1, { xp: 1000 }); // a badge landed after the page painted

    await undoQuestCompletion(q);
    expect((await db.profile.get(1))?.xp).toBe(1000 - 75);
  });

  it("never drives XP negative", async () => {
    const q = quest({ xp: 5000 });
    await db.quests.add(q);
    await completeQuest(profile(), q, 20);
    await db.profile.update(1, { xp: 10 });

    await undoQuestCompletion(q);
    expect((await db.profile.get(1))?.xp).toBe(0);
  });

  // The time was still spent. Un-ticking a quest is not a claim that the day
  // did not happen, so the study log and the streak stay put.
  it("leaves the study log alone", async () => {
    const q = quest();
    await db.quests.add(q);
    await completeQuest(profile(), q, 20);
    const before = await db.studyLog.toArray();

    await undoQuestCompletion(q);
    expect(await db.studyLog.toArray()).toEqual(before);
  });

  it("is a no-op on a quest that was never completed", async () => {
    const q = quest();
    await db.quests.add(q);
    expect(await undoQuestCompletion(q)).toBe("already");
    expect((await db.profile.get(1))?.xp).toBe(0);
  });
});
