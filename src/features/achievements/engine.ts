import { db } from "../../db/schema";
import { ACHIEVEMENT_DEFS, type AchievementDef } from "../../data/achievements";
import { pushToast } from "../../state/toast";
import { xpToLevel } from "../../lib/xp";
import { calibrationCurve } from "../../lib/calibration";
import { readiness, coverageByDomain, PASS_MARK } from "../../lib/readiness";

export type AchievementEvent =
  | { kind: "quest-complete"; questId: string; week: number; day: number }
  | { kind: "quiz-complete"; attemptId: string }
  | { kind: "flashcard-review"; reviewedToday: number; totalDeck: number }
  | { kind: "level-up"; previousLevel: number; newLevel: number }
  | { kind: "streak"; streak: number }
  | { kind: "vault-quick-test"; tableId: string; scorePct: number }
  | { kind: "vault-order-win"; gameId: string };

/**
 * Every id the engine can ever hand to `tryUnlock`, grouped by the check that
 * owns it.
 *
 * This exists because `tryUnlock` is a silent no-op for an unknown id: it looks
 * the id up in DEF_BY_ID and returns false if absent. So a badge defined in the
 * data with no call site here simply never unlocks, and nothing complains —
 * which is exactly the state `bia-first` and `gap-closer` were once in.
 *
 * The checks below use these constants rather than repeating the strings, so
 * the declaration cannot drift from the code that awards them. The test asserts
 * both directions: no badge without a path, and no path without a badge.
 *
 * It proves an id is *wired*, not that its condition is reachable in practice —
 * the per-achievement tests below are the evidence for the conditions.
 */
export const UNLOCK_IDS = {
  streak: ["streak-7", "streak-14", "streak-28"],
  levels: ["level-5", "level-7", "level-10"],
  // Built by template as `week-${n}-clear`; listed so the guard can see them.
  campaign: [
    "week-1-clear", "week-2-clear", "week-3-clear", "week-4-clear",
    "week-5-clear", "week-6-clear", "week-7-clear", "week-8-clear",
  ],
  milestones: ["first-blood", "day-1-quests", "bia-first", "vault-quiz-perfect"],
  mindset: ["think-like-ciso", "no-technician", "calibrated"],
  mastery: ["domain-master-any", "domain-master-d3", "gap-closer", "exam-ready"],
  retry: ["gap-hunter", "no-repeat"],
  boss: ["boss-1-pass", "boss-2-pass", "boss-3-pass"],
  flashcards: ["flashcard-100", "flashcard-500", "full-deck-review"],
} as const;

/** Flattened, for the guard and for anything that needs the whole surface. */
export const ALL_UNLOCK_IDS: readonly string[] = Object.values(UNLOCK_IDS).flat();

const DEF_BY_ID = new Map(ACHIEVEMENT_DEFS.map((d) => [d.id, d]));

async function alreadyUnlocked(id: string): Promise<boolean> {
  return !!(await db.achievements.get(id));
}

async function unlock(def: AchievementDef) {
  const now = new Date().toISOString();
  // put() rather than add(): alreadyUnlocked() is a check-then-act with an await
  // in between, and QuizReviewPage fires three overlapping unawaited check
  // chains, so two can pass the check and the second add() would throw
  // ConstraintError — aborting the rest of that batch.
  await db.achievements.put({ id: def.id, unlockedAt: now });
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
  if (streak >= 7) await tryUnlock(UNLOCK_IDS.streak[0]);
  if (streak >= 14) await tryUnlock(UNLOCK_IDS.streak[1]);
  if (streak >= 28) await tryUnlock(UNLOCK_IDS.streak[2]);
}

async function checkLevels(level: number) {
  if (level >= 5) await tryUnlock(UNLOCK_IDS.levels[0]);
  if (level >= 7) await tryUnlock(UNLOCK_IDS.levels[1]);
  if (level >= 10) await tryUnlock(UNLOCK_IDS.levels[2]);
}

async function checkWeekClear(week: number) {
  if (week < 1 || week > 8) return;
  const weekQuests = await db.quests.where("week").equals(week).toArray();
  if (weekQuests.length === 0) return;
  const allDone = weekQuests.every((q) => !!q.completedAt);
  if (allDone) await tryUnlock(UNLOCK_IDS.campaign[week - 1]);
}

async function checkDayOneQuests() {
  const d1 = await db.quests.where("week").equals(1).toArray();
  const day1 = d1.filter((q) => q.day === 1);
  if (day1.length > 0 && day1.every((q) => !!q.completedAt)) {
    await tryUnlock(UNLOCK_IDS.milestones[1]);
  }
}

async function checkFirstBlood() {
  const count = await db.attempts.count();
  if (count >= 1) await tryUnlock(UNLOCK_IDS.milestones[0]);
}

async function checkMindsetAchievements() {
  const p = await db.profile.get(1);
  if (!p) return;
  if (p.mindsetChoicesCorrect >= 25) await tryUnlock(UNLOCK_IDS.mindset[0]);
}

async function checkNoTechnicianOnAttempt(attemptId: string) {
  const ans = await db.answers.where("attemptId").equals(attemptId).toArray();
  if (ans.length < 50) return;
  const mindsetMisses = ans.filter((a) => a.flaggedMindset).length;
  if (mindsetMisses / ans.length < 0.1) await tryUnlock(UNLOCK_IDS.mindset[1]);
}

async function checkDomainMastery(attemptId: string) {
  const attempt = await db.attempts.get(attemptId);
  if (!attempt) return;
  if (attempt.mode !== "domain") return;
  if (attempt.scorePct >= 85) await tryUnlock(UNLOCK_IDS.mastery[0]);
  if (attempt.domainId === 3 && attempt.scorePct >= 80) await tryUnlock(UNLOCK_IDS.mastery[1]);
}

const BOSS_2_PCT = 70;
const BOSS_3_PCT = 75;

/**
 * Boss badges, gated on how many full-length exams have been finished.
 *
 * These used to fire on *any* full exam meeting the score, so a single 78% in
 * week 4 unlocked all three at once and left weeks 6 and 7 with no reward. The
 * plan intends one boss per checkpoint, but nothing links an attempt back to
 * the quest that prompted it — attempts carry no quest id, and no screen
 * launches a quiz from a quest — so gating on the actual week would mean
 * inventing that link rather than fixing a defect.
 *
 * Ordinal is the honest approximation: the second exam can earn the second
 * badge, the third the third. The achievement descriptions were reworded to
 * say that, rather than promising week-gating the code does not do.
 */
async function checkBossFights(attemptId: string) {
  const attempt = await db.attempts.get(attemptId);
  if (!attempt || attempt.mode !== "full" || !attempt.finishedAt) return;

  const fullExams = (await db.attempts.where("mode").equals("full").toArray())
    .filter((a) => a.finishedAt)
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt));

  const ordinal = fullExams.findIndex((a) => a.id === attempt.id) + 1;
  if (ordinal < 1) return;

  if (ordinal >= 1) await tryUnlock(UNLOCK_IDS.boss[0]);
  if (ordinal >= 2 && attempt.scorePct >= BOSS_2_PCT) await tryUnlock(UNLOCK_IDS.boss[1]);
  if (ordinal >= 3 && attempt.scorePct >= BOSS_3_PCT) await tryUnlock(UNLOCK_IDS.boss[2]);
}

async function checkFlashcardCounts(reviewedToday: number, totalDeck: number) {
  if (reviewedToday >= 100) await tryUnlock(UNLOCK_IDS.flashcards[0]);
  const all = await db.studyLog.toArray();
  const lifetime = all.reduce((s, d) => s + (d.flashcardsReviewed || 0), 0);
  if (lifetime >= 500) await tryUnlock(UNLOCK_IDS.flashcards[1]);
  if (totalDeck > 0 && reviewedToday >= totalDeck) await tryUnlock(UNLOCK_IDS.flashcards[2]);
}

async function checkVaultQuickTest(scorePct: number) {
  if (scorePct >= 100) await tryUnlock(UNLOCK_IDS.milestones[3]);
}

const BIA_WINS_REQUIRED = 5;

/** "Correctly order BCP steps 5 times" — counted in the vaultWins store. */
async function checkVaultOrderWin(gameId: string) {
  if (gameId !== "bcp-steps") return;
  const row = await db.vaultWins.get(gameId);
  if ((row?.wins ?? 0) >= BIA_WINS_REQUIRED) await tryUnlock(UNLOCK_IDS.milestones[2]);
}

const GAP_WEAK_PCT = 60;
const GAP_RECOVERED_PCT = 70;

/**
 * "Raise a weak domain from <60% to 70%+".
 *
 * Uses the same running average the Stats page shows, so the badge fires on the
 * number the user can actually see: the domain must have averaged below 60% at
 * some earlier point and be at 70%+ now.
 */
async function checkGapCloser(attemptId: string) {
  const attempt = await db.attempts.get(attemptId);
  if (!attempt || attempt.domainId === null) return;

  const domainAttempts = (await db.attempts.where("mode").equals("domain").toArray())
    .filter((a) => a.finishedAt && a.domainId === attempt.domainId)
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt));

  if (domainAttempts.length < 2) return;

  const avgOfFirst = (count: number) =>
    Math.round(
      domainAttempts.slice(0, count).reduce((s, a) => s + a.scorePct, 0) / count,
    );

  const current = avgOfFirst(domainAttempts.length);
  if (current < GAP_RECOVERED_PCT) return;

  // Was the running average ever under the weak line before now?
  const wasWeak = domainAttempts
    .slice(0, -1)
    .some((_, i) => avgOfFirst(i + 1) < GAP_WEAK_PCT);
  if (wasWeak) await tryUnlock(UNLOCK_IDS.mastery[2]);
}

/** Enough of a run that it represents clearing the queue, not one lucky retry. */
const GAP_HUNTER_MIN_QUESTIONS = 10;
/** Missed this many times before getting it right is a genuine turnaround. */
const NO_REPEAT_MIN_MISSES = 2;

async function checkGapHunter(attemptId: string) {
  const attempt = await db.attempts.get(attemptId);
  if (!attempt || attempt.mode !== "misses" || !attempt.finishedAt) return;
  if (attempt.questionIds.length >= GAP_HUNTER_MIN_QUESTIONS) {
    await tryUnlock(UNLOCK_IDS.retry[0]);
  }
}

/**
 * Rewards the turnaround rather than the streak: a question that beat you twice
 * and then didn't. Reads timesMissed from the review row, which applyReview
 * leaves untouched on a correct answer, so the historical count is still there
 * when this runs.
 */
async function checkNoRepeat(attemptId: string) {
  const answers = await db.answers.where("attemptId").equals(attemptId).toArray();
  for (const a of answers) {
    if (!a.correct) continue;
    const review = await db.questionReviews.get(a.questionId);
    if (review && review.timesMissed >= NO_REPEAT_MIN_MISSES) {
      await tryUnlock(UNLOCK_IDS.retry[1]);
      return;
    }
  }
}

/** calibrationCurve already refuses below its own sample floor, so the "real
 *  sample" requirement is enforced there rather than duplicated here. */
async function checkCalibrated() {
  const answers = await db.answers.toArray();
  const curve = calibrationCurve(answers);
  if (!curve.insufficient && curve.verdict === "well-calibrated") {
    await tryUnlock(UNLOCK_IDS.mindset[2]);
  }
}

/**
 * Gated on confidence as well as score, deliberately. Readiness reports "high"
 * only when every domain is tested and covered, so this cannot be earned by
 * drilling two domains to 90% and leaving the rest untouched — the same
 * restraint the readiness feature applies to itself.
 */
async function checkExamReady() {
  const [attempts, answers, questions] = await Promise.all([
    db.attempts.toArray(),
    db.answers.toArray(),
    db.questions.toArray(),
  ]);
  const domainOf = new Map(questions.map((q) => [q.id, q.domainId as number]));
  const r = readiness(attempts, coverageByDomain(answers, (id) => domainOf.get(id)));
  if (r.scorePct >= PASS_MARK && r.confidence === "high") {
    await tryUnlock(UNLOCK_IDS.mastery[3]);
  }
}

/**
 * Runs one check in isolation. A single wrapping try/catch around the whole
 * switch meant that if an early check threw, every later check for that event
 * was skipped permanently — nothing re-runs them.
 */
async function run(label: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    console.error(`Achievement check "${label}" failed`, err);
  }
}

export async function checkAchievements(event: AchievementEvent): Promise<void> {
  switch (event.kind) {
    case "quest-complete":
      await run("day-one-quests", () => checkDayOneQuests());
      await run("week-clear", () => checkWeekClear(event.week));
      break;
    case "quiz-complete":
      await run("first-blood", () => checkFirstBlood());
      await run("mindset", () => checkMindsetAchievements());
      await run("no-technician", () => checkNoTechnicianOnAttempt(event.attemptId));
      await run("domain-mastery", () => checkDomainMastery(event.attemptId));
      await run("gap-closer", () => checkGapCloser(event.attemptId));
      await run("boss-fights", () => checkBossFights(event.attemptId));
      await run("gap-hunter", () => checkGapHunter(event.attemptId));
      await run("no-repeat", () => checkNoRepeat(event.attemptId));
      await run("calibrated", () => checkCalibrated());
      await run("exam-ready", () => checkExamReady());
      break;
    case "flashcard-review":
      await run("flashcard-counts", () =>
        checkFlashcardCounts(event.reviewedToday, event.totalDeck),
      );
      break;
    case "level-up":
      await run("levels", () => checkLevels(event.newLevel));
      break;
    case "streak":
      await run("streak", () => checkStreak(event.streak));
      break;
    case "vault-quick-test":
      await run("vault-quick-test", () => checkVaultQuickTest(event.scorePct));
      break;
    case "vault-order-win":
      await run("vault-order-win", () => checkVaultOrderWin(event.gameId));
      break;
  }
}

export function detectLevelUp(prevXp: number, nextXp: number): { crossed: boolean; previousLevel: number; newLevel: number } {
  const prev = xpToLevel(prevXp).level;
  const next = xpToLevel(nextXp).level;
  return { crossed: next > prev, previousLevel: prev, newLevel: next };
}
