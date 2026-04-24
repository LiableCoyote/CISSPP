import { db } from "../../db/schema";
import { ACHIEVEMENT_DEFS, type AchievementDef } from "../../data/achievements";
import { pushToast } from "../../state/toast";
import { xpToLevel } from "../../lib/xp";

export type AchievementEvent =
  | { kind: "quest-complete"; questId: string; week: number; day: number }
  | { kind: "quiz-complete"; attemptId: string }
  | { kind: "flashcard-review"; reviewedToday: number; totalDeck: number }
  | { kind: "level-up"; previousLevel: number; newLevel: number }
  | { kind: "streak"; streak: number }
  | { kind: "vault-quick-test"; tableId: string; scorePct: number };

const DEF_BY_ID = new Map(ACHIEVEMENT_DEFS.map((d) => [d.id, d]));

async function alreadyUnlocked(id: string): Promise<boolean> {
  return !!(await db.achievements.get(id));
}

async function unlock(def: AchievementDef) {
  const now = new Date().toISOString();
  await db.achievements.add({ id: def.id, unlockedAt: now });
  if (def.xp > 0) {
    const p = await db.profile.get(1);
    if (p) await db.profile.update(1, { xp: p.xp + def.xp });
  }
  pushToast({
    variant: "achievement",
    icon: def.icon,
    title: `Achievement Unlocked: ${def.name}`,
    body: def.description,
    xp: def.xp,
    durationMs: 6000,
  });
}

async function tryUnlock(id: string): Promise<boolean> {
  const def = DEF_BY_ID.get(id);
  if (!def) return false;
  if (await alreadyUnlocked(id)) return false;
  await unlock(def);
  return true;
}

async function checkStreak(streak: number) {
  if (streak >= 7) await tryUnlock("streak-7");
  if (streak >= 14) await tryUnlock("streak-14");
  if (streak >= 28) await tryUnlock("streak-28");
}

async function checkLevels(level: number) {
  if (level >= 5) await tryUnlock("level-5");
  if (level >= 7) await tryUnlock("level-7");
  if (level >= 10) await tryUnlock("level-10");
}

async function checkWeekClear(week: number) {
  if (week < 1 || week > 8) return;
  const weekQuests = await db.quests.where("week").equals(week).toArray();
  if (weekQuests.length === 0) return;
  const allDone = weekQuests.every((q) => !!q.completedAt);
  if (allDone) await tryUnlock(`week-${week}-clear`);
}

async function checkDayOneQuests() {
  const d1 = await db.quests.where("week").equals(1).toArray();
  const day1 = d1.filter((q) => q.day === 1);
  if (day1.length > 0 && day1.every((q) => !!q.completedAt)) {
    await tryUnlock("day-1-quests");
  }
}

async function checkFirstBlood() {
  const count = await db.attempts.count();
  if (count >= 1) await tryUnlock("first-blood");
}

async function checkMindsetAchievements() {
  const p = await db.profile.get(1);
  if (!p) return;
  if (p.mindsetChoicesCorrect >= 25) await tryUnlock("think-like-ciso");
}

async function checkNoTechnicianOnAttempt(attemptId: string) {
  const ans = await db.answers.where("attemptId").equals(attemptId).toArray();
  if (ans.length < 50) return;
  const mindsetMisses = ans.filter((a) => a.flaggedMindset).length;
  if (mindsetMisses / ans.length < 0.1) await tryUnlock("no-technician");
}

async function checkDomainMastery(attemptId: string) {
  const attempt = await db.attempts.get(attemptId);
  if (!attempt) return;
  if (attempt.mode !== "domain") return;
  if (attempt.scorePct >= 85) await tryUnlock("domain-master-any");
  if (attempt.domainId === 3 && attempt.scorePct >= 80) await tryUnlock("domain-master-d3");
}

async function checkBossFights(attemptId: string) {
  const attempt = await db.attempts.get(attemptId);
  if (!attempt || attempt.mode !== "full") return;

  // Week 4 boss: completion is the bar.
  const week4Exam = await db.quests
    .where("week")
    .equals(4)
    .filter((q) => q.type === "exam")
    .toArray();
  if (week4Exam.some((q) => q.completedAt)) await tryUnlock("boss-1-pass");

  // Week 6 boss: 70%+. Week 7: 75%+.
  if (attempt.scorePct >= 70) await tryUnlock("boss-2-pass");
  if (attempt.scorePct >= 75) await tryUnlock("boss-3-pass");
}

async function checkFlashcardCounts(reviewedToday: number, totalDeck: number) {
  if (reviewedToday >= 100) await tryUnlock("flashcard-100");
  const all = await db.studyLog.toArray();
  const lifetime = all.reduce((s, d) => s + (d.flashcardsReviewed || 0), 0);
  if (lifetime >= 500) await tryUnlock("flashcard-500");
  if (totalDeck > 0 && reviewedToday >= totalDeck) await tryUnlock("full-deck-review");
}

async function checkVaultQuickTest(scorePct: number) {
  if (scorePct >= 100) await tryUnlock("vault-quiz-perfect");
}

export async function checkAchievements(event: AchievementEvent): Promise<void> {
  try {
    switch (event.kind) {
      case "quest-complete":
        await checkDayOneQuests();
        await checkWeekClear(event.week);
        break;
      case "quiz-complete":
        await checkFirstBlood();
        await checkMindsetAchievements();
        await checkNoTechnicianOnAttempt(event.attemptId);
        await checkDomainMastery(event.attemptId);
        await checkBossFights(event.attemptId);
        break;
      case "flashcard-review":
        await checkFlashcardCounts(event.reviewedToday, event.totalDeck);
        break;
      case "level-up":
        await checkLevels(event.newLevel);
        break;
      case "streak":
        await checkStreak(event.streak);
        break;
      case "vault-quick-test":
        await checkVaultQuickTest(event.scorePct);
        break;
    }
  } catch (err) {
    console.error("Achievement check failed", err);
  }
}

export function detectLevelUp(prevXp: number, nextXp: number): { crossed: boolean; previousLevel: number; newLevel: number } {
  const prev = xpToLevel(prevXp).level;
  const next = xpToLevel(nextXp).level;
  return { crossed: next > prev, previousLevel: prev, newLevel: next };
}
