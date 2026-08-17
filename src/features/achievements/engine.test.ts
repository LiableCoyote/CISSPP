import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { db, type QuizAttempt, type Profile } from "../../db/schema";
import {
  checkAchievements,
  detectLevelUp,
  retryPendingChecks,
  ALL_UNLOCK_IDS,
  MAX_CHECK_ATTEMPTS,
} from "./engine";
import { ACHIEVEMENT_DEFS } from "../../data/achievements";
import { LEVEL_XP_THRESHOLDS } from "../../lib/xp";
import { useToast } from "../../state/toast";

function fullExam(id: string, scorePct: number, minutesAgo: number): QuizAttempt {
  const at = new Date(Date.now() - minutesAgo * 60_000).toISOString();
  return {
    id,
    mode: "full",
    domainId: null,
    questionIds: [],
    startedAt: at,
    finishedAt: at,
    totalSeconds: 10_800,
    score: scorePct,
    scorePct,
    passed: scorePct >= 70,
    targetScorePct: 70,
  };
}

async function unlocked() {
  return (await db.achievements.toArray()).map((a) => a.id);
}

beforeEach(async () => {
  await db.achievements.clear();
  await db.attempts.clear();
  await db.profile.clear();
  await db.answers.clear();
  await db.questionReviews.clear();
  await db.questions.clear();
  await db.pendingChecks.clear();
});

describe("boss badges", () => {
  // These used to fire on any full exam meeting the score, so one strong early
  // exam swept all three and left the later checkpoints with nothing to earn.
  it("a single high-scoring exam earns only the first badge", async () => {
    await db.attempts.add(fullExam("e1", 92, 30));
    await checkAchievements({ kind: "quiz-complete", attemptId: "e1" });

    const ids = await unlocked();
    expect(ids).toContain("boss-1-pass");
    expect(ids).not.toContain("boss-2-pass");
    expect(ids).not.toContain("boss-3-pass");
  });

  it("the second exam can earn the second badge", async () => {
    await db.attempts.bulkAdd([fullExam("e1", 65, 60), fullExam("e2", 72, 30)]);
    await checkAchievements({ kind: "quiz-complete", attemptId: "e2" });

    const ids = await unlocked();
    expect(ids).toContain("boss-2-pass");
    expect(ids).not.toContain("boss-3-pass");
  });

  it("the third exam can earn the third badge", async () => {
    await db.attempts.bulkAdd([
      fullExam("e1", 65, 90),
      fullExam("e2", 72, 60),
      fullExam("e3", 80, 30),
    ]);
    await checkAchievements({ kind: "quiz-complete", attemptId: "e3" });
    expect(await unlocked()).toContain("boss-3-pass");
  });

  it("holds the later badges back when the score is short", async () => {
    await db.attempts.bulkAdd([fullExam("e1", 50, 60), fullExam("e2", 65, 30)]);
    await checkAchievements({ kind: "quiz-complete", attemptId: "e2" });
    expect(await unlocked()).not.toContain("boss-2-pass");
  });

  it("ignores unfinished exams", async () => {
    await db.attempts.add({ ...fullExam("e1", 90, 30), finishedAt: null });
    await checkAchievements({ kind: "quiz-complete", attemptId: "e1" });
    expect(await unlocked()).not.toContain("boss-1-pass");
  });

  it("is idempotent — re-checking does not throw on an already-unlocked badge", async () => {
    await db.attempts.add(fullExam("e1", 92, 30));
    await checkAchievements({ kind: "quiz-complete", attemptId: "e1" });
    await expect(
      checkAchievements({ kind: "quiz-complete", attemptId: "e1" }),
    ).resolves.toBeUndefined();
    expect((await unlocked()).filter((id) => id === "boss-1-pass")).toHaveLength(1);
  });
});

describe("every achievement is reachable", () => {
  /**
   * The previous version of this block was named for this guarantee and did not
   * provide it: it asserted only that there were 29 definitions and that the
   * ids were unique. Neither would notice a badge added with no way to earn it,
   * which is the exact state bia-first and gap-closer were once in.
   *
   * `tryUnlock` is a silent no-op for an unknown id, so the failure mode is a
   * badge that simply never appears. UNLOCK_IDS is the surface the engine
   * actually awards from — the checks use those constants — so comparing the
   * two sets catches the drift in both directions.
   *
   * This proves an id is wired, not that its condition can be met. The
   * behavioural blocks above are the evidence for the conditions.
   */
  it("has no definition without an unlock path in the engine", () => {
    const defined = ACHIEVEMENT_DEFS.map((d) => d.id);
    const orphaned = defined.filter((id) => !ALL_UNLOCK_IDS.includes(id));
    expect(orphaned).toEqual([]);
  });

  it("has no unlock path pointing at a badge that does not exist", () => {
    // The other direction: a renamed or deleted def leaves a tryUnlock call
    // that quietly does nothing, because tryUnlock swallows the miss.
    const defined = new Set(ACHIEVEMENT_DEFS.map((d) => d.id));
    const dangling = ALL_UNLOCK_IDS.filter((id) => !defined.has(id));
    expect(dangling).toEqual([]);
  });

  it("gives every definition a unique id", () => {
    const ids = ACHIEVEMENT_DEFS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("detectLevelUp", () => {
  it("reports a crossing", () => {
    const r = detectLevelUp(LEVEL_XP_THRESHOLDS[1] - 1, LEVEL_XP_THRESHOLDS[1]);
    expect(r.crossed).toBe(true);
    expect(r.previousLevel).toBe(0);
    expect(r.newLevel).toBe(1);
  });

  it("reports no crossing within a level", () => {
    expect(detectLevelUp(10, 20).crossed).toBe(false);
  });

  it("does not report a crossing when XP goes down", () => {
    expect(detectLevelUp(LEVEL_XP_THRESHOLDS[2], LEVEL_XP_THRESHOLDS[1]).crossed).toBe(false);
  });
});


/* ── badges for the retry / calibration / readiness loop ─────────────────── */

function missesRun(id: string, questionCount: number): QuizAttempt {
  const at = new Date().toISOString();
  return {
    id,
    mode: "misses",
    domainId: null,
    questionIds: Array.from({ length: questionCount }, (_, i) => `q-${i}`),
    startedAt: at,
    finishedAt: at,
    totalSeconds: 600,
    score: questionCount,
    scorePct: 100,
    passed: null,
    targetScorePct: null,
  };
}

const answerRow = (attemptId: string, questionId: string, correct: boolean, confidence: 1 | 2 | 3 | 4 | 5 | null) => ({
  id: `${attemptId}-${questionId}`,
  attemptId,
  questionId,
  pickedIndex: 0,
  correct,
  timeTakenMs: 30_000,
  flaggedMindset: false,
  flaggedSpeed: false,
  missCategory: null,
  confidence,
});

describe("gap-hunter", () => {
  it("unlocks on a retry run long enough to represent clearing the queue", async () => {
    await db.attempts.add(missesRun("m1", 12));
    await checkAchievements({ kind: "quiz-complete", attemptId: "m1" });
    expect(await unlocked()).toContain("gap-hunter");
  });

  it("does not unlock on a short retry run", async () => {
    await db.attempts.add(missesRun("m2", 3));
    await checkAchievements({ kind: "quiz-complete", attemptId: "m2" });
    expect(await unlocked()).not.toContain("gap-hunter");
  });

  // The badge is for closing gaps, not for any long quiz.
  it("does not unlock on an ordinary quiz of the same length", async () => {
    const a = { ...missesRun("m3", 20), mode: "mixed" as const };
    await db.attempts.add(a);
    await checkAchievements({ kind: "quiz-complete", attemptId: "m3" });
    expect(await unlocked()).not.toContain("gap-hunter");
  });
});

describe("no-repeat", () => {
  const review = (questionId: string, timesMissed: number) => ({
    questionId,
    domainId: 1 as const,
    ease: 2.5,
    interval: 1,
    reps: 0,
    lapses: timesMissed,
    dueAt: new Date().toISOString(),
    lastReviewedAt: null,
    timesMissed,
    firstMissedAt: new Date().toISOString(),
  });

  it("unlocks when a twice-missed question is finally answered correctly", async () => {
    await db.attempts.add(missesRun("r1", 1));
    await db.questionReviews.put(review("q-0", 2));
    await db.answers.add(answerRow("r1", "q-0", true, null));
    await checkAchievements({ kind: "quiz-complete", attemptId: "r1" });
    expect(await unlocked()).toContain("no-repeat");
  });

  it("does not unlock for a question missed only once", async () => {
    await db.attempts.add(missesRun("r2", 1));
    await db.questionReviews.put(review("q-0", 1));
    await db.answers.add(answerRow("r2", "q-0", true, null));
    await checkAchievements({ kind: "quiz-complete", attemptId: "r2" });
    expect(await unlocked()).not.toContain("no-repeat");
  });

  it("does not unlock when the twice-missed question is missed again", async () => {
    await db.attempts.add(missesRun("r3", 1));
    await db.questionReviews.put(review("q-0", 3));
    await db.answers.add(answerRow("r3", "q-0", false, null));
    await checkAchievements({ kind: "quiz-complete", attemptId: "r3" });
    expect(await unlocked()).not.toContain("no-repeat");
  });
});

describe("calibrated", () => {
  it("unlocks when confidence tracks accuracy over a real sample", async () => {
    await db.attempts.add(missesRun("c1", 1));
    // Certain and right 19/20; guessing and wrong 8/10 — close to the curve.
    for (let i = 0; i < 20; i++) await db.answers.add(answerRow("c1", `k-${i}`, i < 19, 5));
    for (let i = 0; i < 10; i++) await db.answers.add(answerRow("c1", `g-${i}`, i < 2, 1));
    await checkAchievements({ kind: "quiz-complete", attemptId: "c1" });
    expect(await unlocked()).toContain("calibrated");
  });

  it("does not unlock for someone certain and wrong", async () => {
    await db.attempts.add(missesRun("c2", 1));
    for (let i = 0; i < 30; i++) await db.answers.add(answerRow("c2", `k-${i}`, i < 12, 5));
    await checkAchievements({ kind: "quiz-complete", attemptId: "c2" });
    expect(await unlocked()).not.toContain("calibrated");
  });

  // calibrationCurve refuses below its own sample floor, so the badge inherits
  // that refusal rather than restating the threshold.
  it("does not unlock on too few rated answers", async () => {
    await db.attempts.add(missesRun("c3", 1));
    for (let i = 0; i < 6; i++) await db.answers.add(answerRow("c3", `k-${i}`, true, 5));
    await checkAchievements({ kind: "quiz-complete", attemptId: "c3" });
    expect(await unlocked()).not.toContain("calibrated");
  });
});

describe("exam-ready", () => {
  const domainAttempt = (id: string, domainId: number, scorePct: number): QuizAttempt => {
    const at = new Date().toISOString();
    return {
      id, mode: "domain", domainId: domainId as QuizAttempt["domainId"], questionIds: [],
      startedAt: at, finishedAt: at, totalSeconds: 600,
      score: scorePct, scorePct, passed: null, targetScorePct: null,
    };
  };

  async function seedCoverage(scorePct: number, answersPerDomain: number) {
    for (let d = 1; d <= 8; d++) {
      await db.attempts.add(domainAttempt(`d${d}`, d, scorePct));
      for (let i = 0; i < answersPerDomain; i++) {
        const qid = `d${d}-q${i}`;
        await db.questions.add({
          id: qid, domainId: d as 1, prompt: "p", options: ["a", "b", "c", "d"],
          answerIndex: 0, explanation: "e", tags: [], isMindsetHeavy: false,
        });
        await db.answers.add(answerRow("cov", qid, true, null));
      }
    }
  }

  it("unlocks at the pass mark with every domain properly covered", async () => {
    await seedCoverage(85, 25);
    await db.attempts.add(missesRun("x1", 1));
    await checkAchievements({ kind: "quiz-complete", attemptId: "x1" });
    expect(await unlocked()).toContain("exam-ready");
  });

  it("does not unlock below the pass mark", async () => {
    await seedCoverage(55, 25);
    await db.attempts.add(missesRun("x2", 1));
    await checkAchievements({ kind: "quiz-complete", attemptId: "x2" });
    expect(await unlocked()).not.toContain("exam-ready");
  });

  // The point of gating on confidence: a high score across two domains is not
  // readiness, and the badge must not say it is.
  it("does not unlock on a high score with most domains untested", async () => {
    await db.attempts.add(domainAttempt("only1", 1, 100));
    await db.attempts.add(domainAttempt("only2", 2, 100));
    await db.attempts.add(missesRun("x3", 1));
    await checkAchievements({ kind: "quiz-complete", attemptId: "x3" });
    expect(await unlocked()).not.toContain("exam-ready");
  });
});

/* ── the retry queue ─────────────────────────────────────────────────────── */

/**
 * Isolating each check stopped one failure killing the rest of the batch, but
 * the failed check itself was only logged and nothing re-ran it. The triggering
 * event is gone by then, so a badge earned during a transient IndexedDB error
 * was never awarded and never would be.
 *
 * `db.attempts.count()` is called by exactly one check — first-blood — so
 * rejecting it fails precisely that check and leaves the others alone. That is
 * what makes the isolation assertion below meaningful rather than incidental.
 */
describe("failed achievement checks", () => {
  const FIRST_BLOOD_XP = ACHIEVEMENT_DEFS.find((d) => d.id === "first-blood")!.xp;

  const profileRow = (xp: number): Profile => ({
    id: 1,
    displayName: "T",
    examDate: null,
    dailyGoalMinutes: 60,
    startDate: "2026-01-01",
    xp,
    streak: 0,
    longestStreak: 0,
    streakFreezesUsedThisWeek: 0,
    streakWeekKey: "2026-W01",
    lastActiveDate: null,
    mindsetChoicesCorrect: 0,
    technicianMisses: 0,
    speedReaderMisses: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
  });

  function breakFirstBlood() {
    return vi
      .spyOn(db.attempts, "count")
      .mockRejectedValue(new Error("UnknownError: database connection lost"));
  }

  beforeEach(() => {
    useToast.setState({ toasts: [] });
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("queues the one that failed and still runs the ones after it", async () => {
    await db.attempts.add(fullExam("e1", 92, 30));
    breakFirstBlood();

    await checkAchievements({ kind: "quiz-complete", attemptId: "e1" });

    const ids = await unlocked();
    expect(ids).not.toContain("first-blood");
    // boss-fights runs after first-blood in the same batch — the isolation the
    // queue is built on top of, re-asserted here because it is easy to break.
    expect(ids).toContain("boss-1-pass");

    const queued = await db.pendingChecks.toArray();
    expect(queued).toHaveLength(1);
    expect(queued[0].label).toBe("first-blood");
    expect(queued[0].attempts).toBe(1);
    expect(queued[0].id).toBe("quiz-complete:first-blood:e1");
  });

  // Otherwise a check that fails on every launch grows the queue without bound.
  it("collapses repeated failures of the same check onto one row", async () => {
    await db.attempts.add(fullExam("e1", 92, 30));
    breakFirstBlood();

    await checkAchievements({ kind: "quiz-complete", attemptId: "e1" });
    await checkAchievements({ kind: "quiz-complete", attemptId: "e1" });

    const queued = await db.pendingChecks.toArray();
    expect(queued).toHaveLength(1);
    expect(queued[0].attempts).toBe(2);
    expect(queued[0].firstFailedAt <= queued[0].lastFailedAt).toBe(true);
  });

  it("keeps separate rows for the same check failing on different events", async () => {
    await db.attempts.bulkAdd([fullExam("e1", 92, 60), fullExam("e2", 88, 30)]);
    breakFirstBlood();

    await checkAchievements({ kind: "quiz-complete", attemptId: "e1" });
    await checkAchievements({ kind: "quiz-complete", attemptId: "e2" });

    expect(await db.pendingChecks.count()).toBe(2);
  });

  it("awards the badge on the next startup once the failure clears", async () => {
    await db.attempts.add(fullExam("e1", 92, 30));
    const spy = breakFirstBlood();

    await checkAchievements({ kind: "quiz-complete", attemptId: "e1" });
    expect(await unlocked()).not.toContain("first-blood");

    spy.mockRestore();
    await retryPendingChecks();

    expect(await unlocked()).toContain("first-blood");
    expect(await db.pendingChecks.count()).toBe(0);
  });

  /**
   * The property the whole design rests on. `tryUnlock` returns early on
   * `alreadyUnlocked`, so replaying a check cannot pay out twice — asserted on
   * the profile's XP rather than on the toast, because XP is the thing that
   * would actually be wrong.
   */
  it("does not pay out twice when the badge was unlocked in the meantime", async () => {
    await db.profile.put(profileRow(0));
    await db.attempts.add(fullExam("e1", 92, 30));

    const spy = breakFirstBlood();
    await checkAchievements({ kind: "quiz-complete", attemptId: "e1" });
    spy.mockRestore();

    // The badge is earned by an ordinary later run while the row is still queued.
    await checkAchievements({ kind: "quiz-complete", attemptId: "e1" });
    const afterUnlock = (await db.profile.get(1))!.xp;
    expect(afterUnlock).toBeGreaterThanOrEqual(FIRST_BLOOD_XP);

    await retryPendingChecks();

    expect((await db.profile.get(1))!.xp).toBe(afterUnlock);
    expect((await unlocked()).filter((id) => id === "first-blood")).toHaveLength(1);
    expect(await db.pendingChecks.count()).toBe(0);
  });

  // A rename or removal leaves rows nothing can resolve. Retrying them forever
  // is the failure mode this avoids.
  it("drops a queued check whose label no longer exists", async () => {
    await db.pendingChecks.put({
      id: "quiz-complete:check-from-an-older-build:e1",
      label: "check-from-an-older-build",
      event: { kind: "quiz-complete", attemptId: "e1" },
      firstFailedAt: "2026-01-01T00:00:00.000Z",
      lastFailedAt: "2026-01-01T00:00:00.000Z",
      attempts: 1,
    });

    await expect(retryPendingChecks()).resolves.toBeUndefined();
    expect(await db.pendingChecks.count()).toBe(0);
  });

  it("counts a failed retry rather than losing the row", async () => {
    await db.attempts.add(fullExam("e1", 92, 30));
    breakFirstBlood();

    await checkAchievements({ kind: "quiz-complete", attemptId: "e1" });
    await retryPendingChecks();

    const queued = await db.pendingChecks.toArray();
    expect(queued).toHaveLength(1);
    expect(queued[0].attempts).toBe(2);
  });

  it("gives up after the attempt ceiling, and says so", async () => {
    await db.attempts.add(fullExam("e1", 92, 30));
    await db.pendingChecks.put({
      id: "quiz-complete:first-blood:e1",
      label: "first-blood",
      event: { kind: "quiz-complete", attemptId: "e1" },
      firstFailedAt: "2026-01-01T00:00:00.000Z",
      lastFailedAt: "2026-01-01T00:00:00.000Z",
      attempts: MAX_CHECK_ATTEMPTS - 1,
    });
    breakFirstBlood();

    await retryPendingChecks();

    expect(await db.pendingChecks.count()).toBe(0);
    const toasts = useToast.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0].variant).toBe("warn");
    expect(toasts[0].title).toBe("Couldn't check for new achievements");
  });

  // Transient failures are not worth interrupting for: a retry is coming and
  // there is nothing the user can do about it.
  it("stays quiet while a retry is still coming", async () => {
    await db.attempts.add(fullExam("e1", 92, 30));
    breakFirstBlood();

    await checkAchievements({ kind: "quiz-complete", attemptId: "e1" });
    await retryPendingChecks();

    // Warnings only: the same batch legitimately unlocks boss-1-pass, and that
    // toast is the feature working.
    expect(useToast.getState().toasts.filter((t) => t.variant === "warn")).toHaveLength(0);
  });
});
