import { db, type PendingCheck } from "../../db/schema";
import { ACHIEVEMENT_DEFS, type AchievementDef } from "../../data/achievements";
import { pushToast } from "../../state/toast";
import { reportFailure } from "../../lib/failure";
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

type Check = { label: string; fn: () => Promise<void> };

/**
 * The checks an event triggers, as data.
 *
 * Written as a table rather than inline `run(...)` calls because the retry path
 * rebuilds the failed check from a stored event and has to get *the same*
 * check. A second copy of this switch living next to the queue would drift the
 * first time a check was added on one side only — and the symptom would be a
 * retry that silently ran nothing.
 *
 * Labels are the stored identity of a check, so renaming one abandons its
 * queued rows. That is the intended trade: a rename means the old check no
 * longer exists, and `retryPendingChecks` drops rows it cannot resolve rather
 * than keeping them forever.
 */
function checksFor(event: AchievementEvent): Check[] {
  switch (event.kind) {
    case "quest-complete":
      return [
        { label: "day-one-quests", fn: () => checkDayOneQuests() },
        { label: "week-clear", fn: () => checkWeekClear(event.week) },
      ];
    case "quiz-complete":
      return [
        { label: "first-blood", fn: () => checkFirstBlood() },
        { label: "mindset", fn: () => checkMindsetAchievements() },
        { label: "no-technician", fn: () => checkNoTechnicianOnAttempt(event.attemptId) },
        { label: "domain-mastery", fn: () => checkDomainMastery(event.attemptId) },
        { label: "gap-closer", fn: () => checkGapCloser(event.attemptId) },
        { label: "boss-fights", fn: () => checkBossFights(event.attemptId) },
        { label: "gap-hunter", fn: () => checkGapHunter(event.attemptId) },
        { label: "no-repeat", fn: () => checkNoRepeat(event.attemptId) },
        { label: "calibrated", fn: () => checkCalibrated() },
        { label: "exam-ready", fn: () => checkExamReady() },
      ];
    case "flashcard-review":
      return [
        {
          label: "flashcard-counts",
          fn: () => checkFlashcardCounts(event.reviewedToday, event.totalDeck),
        },
      ];
    case "level-up":
      return [{ label: "levels", fn: () => checkLevels(event.newLevel) }];
    case "streak":
      return [{ label: "streak", fn: () => checkStreak(event.streak) }];
    case "vault-quick-test":
      return [{ label: "vault-quick-test", fn: () => checkVaultQuickTest(event.scorePct) }];
    case "vault-order-win":
      return [{ label: "vault-order-win", fn: () => checkVaultOrderWin(event.gameId) }];
    default:
      // Unreachable for a well-formed event, but `retryPendingChecks` feeds
      // this rows read back from IndexedDB, which an older or newer build may
      // have written. An unknown kind resolves to no checks, and the row is
      // dropped rather than retried forever.
      return [];
  }
}

/**
 * The check labels an event will run, for the guard that keeps a real check
 * from claiming the reserved batch label. Exported rather than `checksFor`
 * itself so the closures over event data stay internal.
 */
export function labelsFor(event: AchievementEvent): string[] {
  return checksFor(event).map((c) => c.label);
}

/**
 * Identifies the occasion a check ran on, so the same check failing twice for
 * the same reason updates one queue row instead of adding a second.
 *
 * Deliberately made of the event's own fields rather than a timestamp: two
 * separate quizzes should queue separately, but one quiz retried four times
 * should not accumulate four rows.
 */
function eventKey(event: AchievementEvent): string {
  switch (event.kind) {
    case "quest-complete":
      return event.questId;
    case "quiz-complete":
      return event.attemptId;
    case "flashcard-review":
      return `${event.reviewedToday}-${event.totalDeck}`;
    case "level-up":
      return `${event.previousLevel}-${event.newLevel}`;
    case "streak":
      return String(event.streak);
    case "vault-quick-test":
      return `${event.tableId}-${event.scorePct}`;
    case "vault-order-win":
      return event.gameId;
    default:
      return "unknown";
  }
}

/**
 * Records a failed check so startup can run it again.
 *
 * Guarded, and the guard is the point: the queue lives in the same database the
 * check was reading when it threw, so whatever broke the check can break this
 * write too. An unguarded failure here would escape `run` and take out every
 * later check for the event — reintroducing the exact bug the isolation exists
 * to prevent.
 */
async function enqueue(label: string, event: AchievementEvent): Promise<void> {
  const id = `${event.kind}:${label}:${eventKey(event)}`;
  const now = new Date().toISOString();
  try {
    const existing = await db.pendingChecks.get(id);
    const row: PendingCheck = {
      id,
      label,
      event,
      firstFailedAt: existing?.firstFailedAt ?? now,
      lastFailedAt: now,
      attempts: (existing?.attempts ?? 0) + 1,
    };
    await db.pendingChecks.put(row);
  } catch (err) {
    console.error(`Could not queue achievement check "${label}" for retry`, err);
  }
}

/**
 * Runs one check in isolation. A single wrapping try/catch around the whole
 * switch meant that if an early check threw, every later check for that event
 * was skipped permanently.
 *
 * Isolation alone still lost the failed check: the triggering event has passed
 * by the time anyone notices, so a badge earned during a transient IndexedDB
 * error was never awarded and never would be. Now the failure is queued.
 */
async function run(check: Check, event: AchievementEvent): Promise<void> {
  try {
    await check.fn();
  } catch (err) {
    console.error(`Achievement check "${check.label}" failed`, err);
    await enqueue(check.label, event);
  }
}

/**
 * Reserved label meaning "this whole event's batch may not have finished".
 *
 * Not a real check — `checksFor` never returns it, and a test asserts no check
 * ever claims it, because a collision would make a genuine failure look like an
 * unfinished batch.
 */
export const BATCH_LABEL = "*batch*";

export async function checkAchievements(event: AchievementEvent): Promise<void> {
  // Written before anything runs, deleted after everything has.
  //
  // The per-check rows recover a check that *threw*. They cannot recover a
  // batch that never ran: close the tab or lose the page mid-award and nothing
  // anywhere records that the event happened at all, so there is nothing to
  // replay and the badge is gone. This row is that record.
  //
  // Guarded like enqueue, and for the same reason — if the marker cannot be
  // written, the checks should still run rather than the whole event failing on
  // its bookkeeping.
  const batchId = `${event.kind}:${BATCH_LABEL}:${eventKey(event)}`;
  try {
    const existing = await db.pendingChecks.get(batchId);
    const now = new Date().toISOString();
    await db.pendingChecks.put({
      id: batchId,
      label: BATCH_LABEL,
      event,
      firstFailedAt: existing?.firstFailedAt ?? now,
      lastFailedAt: now,
      attempts: existing?.attempts ?? 0,
    });
  } catch (err) {
    console.error("Could not mark the achievement batch as started", err);
  }

  for (const check of checksFor(event)) await run(check, event);

  // Reaching here means every check was given its turn. Any that failed left
  // its own row behind, so dropping the marker loses nothing.
  try {
    await db.pendingChecks.delete(batchId);
  } catch (err) {
    console.error("Could not clear the achievement batch marker", err);
  }
}

/**
 * Give up after this many failures. Without a ceiling a check that fails for a
 * permanent reason — content removed, a row that will never exist — would be
 * retried on every launch forever.
 */
export const MAX_CHECK_ATTEMPTS = 5;

/**
 * Re-runs queued checks. Called at startup, best-effort.
 *
 * Safe to run repeatedly because `tryUnlock` returns early on
 * `alreadyUnlocked`, so no badge and no XP can be awarded twice. That is
 * load-bearing for this whole design, and it has its own test rather than being
 * taken on trust.
 *
 * Failures stay quiet while a retry is still coming — the user can do nothing
 * useful with the news. Giving up permanently is different: a badge is gone for
 * good at that point and redoing the activity is the only way to earn it, so
 * that one is worth interrupting for.
 */
export async function retryPendingChecks(): Promise<void> {
  const rows = await db.pendingChecks.orderBy("lastFailedAt").toArray();

  // Batch rows first. A batch row means the event's checks may never have run
  // at all, so replaying the whole batch subsumes any single-check row for the
  // same event — running those afterwards would just repeat work that was only
  // moments ago done.
  const batches = rows.filter((r) => r.label === BATCH_LABEL);
  const singles = rows.filter((r) => r.label !== BATCH_LABEL);
  const eventOf = (r: PendingCheck) => `${r.event.kind}|${eventKey(r.event)}`;
  const replayed = new Set<string>();

  for (const row of batches) {
    if (checksFor(row.event).length === 0) {
      await db.pendingChecks.delete(row.id);
      continue;
    }

    // The counter is bumped *before* the replay rather than after a failure,
    // because checkAchievements swallows individual check failures and so never
    // reports whether the batch achieved anything. What it cannot swallow is a
    // marker that keeps coming back: if the database is broken badly enough
    // that the clear-down fails too, this is what eventually stops the row
    // replaying on every launch forever.
    if (row.attempts + 1 >= MAX_CHECK_ATTEMPTS) {
      await db.pendingChecks.delete(row.id);
      reportFailure(
        "check for new achievements",
        new Error(`achievement batch for ${row.event.kind} gave up after ${row.attempts} attempts`),
        "A badge you earned may be missing. Doing that activity again will pick it up.",
      );
      continue;
    }
    await db.pendingChecks.update(row.id, {
      attempts: row.attempts + 1,
      lastFailedAt: new Date().toISOString(),
    });

    // Clear this event's single-check rows *before* replaying, not after. The
    // replay re-runs every check, so they are redundant — but a check that
    // fails again writes to the same id, and cleaning up afterwards would
    // delete that fresh record instead of the stale one.
    replayed.add(eventOf(row));
    for (const s of singles) {
      if (eventOf(s) === eventOf(row)) await db.pendingChecks.delete(s.id);
    }

    // Through checkAchievements rather than the checks directly, so a check
    // that fails during the replay queues itself exactly as it would have first
    // time round, and the marker is rewritten and cleared by the code that owns
    // it. It preserves the attempts count bumped above.
    await checkAchievements(row.event);
  }

  for (const row of singles) {
    // Already cleared above, as part of its batch replay.
    if (replayed.has(eventOf(row))) continue;

    const check = checksFor(row.event).find((c) => c.label === row.label);
    if (!check) {
      // The check was renamed or removed in a later build. Dead work, not a
      // retry — dropping it is what keeps the queue from holding immortal rows.
      await db.pendingChecks.delete(row.id);
      continue;
    }
    try {
      await check.fn();
      await db.pendingChecks.delete(row.id);
    } catch (err) {
      console.error(`Achievement check "${row.label}" failed on retry`, err);
      if (row.attempts + 1 >= MAX_CHECK_ATTEMPTS) {
        await db.pendingChecks.delete(row.id);
        reportFailure(
          "check for new achievements",
          err,
          "A badge you earned may be missing. Doing that activity again will pick it up.",
        );
      } else {
        await db.pendingChecks.update(row.id, {
          attempts: row.attempts + 1,
          lastFailedAt: new Date().toISOString(),
        });
      }
    }
  }
}

export function detectLevelUp(prevXp: number, nextXp: number): { crossed: boolean; previousLevel: number; newLevel: number } {
  const prev = xpToLevel(prevXp).level;
  const next = xpToLevel(nextXp).level;
  return { crossed: next > prev, previousLevel: prev, newLevel: next };
}
