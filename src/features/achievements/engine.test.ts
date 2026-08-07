import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { db, type QuizAttempt } from "../../db/schema";
import { checkAchievements, detectLevelUp } from "./engine";
import { ACHIEVEMENT_DEFS } from "../../data/achievements";
import { LEVEL_XP_THRESHOLDS } from "../../lib/xp";

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
  it("has no definition without an unlock path in the engine", async () => {
    // Guards the class of bug where a badge exists in the data but nothing can
    // ever award it — bia-first and gap-closer were both in that state.
    const source = ACHIEVEMENT_DEFS.map((d) => d.id);
    expect(source).toHaveLength(29);
    expect(new Set(source).size).toBe(source.length);
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
