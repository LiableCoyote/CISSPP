import type { Question, QuizAnswer, Profile } from "../db/schema";

/**
 * Quiz scoring and question selection, lifted out of QuizSessionPage.
 *
 * `scorePct` keys almost everything downstream — domain velocity, boss badges,
 * the gap-closer signal, the remediation banner — and until this file existed
 * it was computed inline in a component and verified nowhere.
 */

export type QuizMode = "domain" | "mixed" | "full" | "misses";

/** How many questions each mode serves, before the pool runs out. */
export const MODE_LIMITS: Record<QuizMode, number> = {
  full: 150,
  mixed: 50,
  domain: 25,
  misses: 25,
};

/** Seconds on the clock per mode. */
export const MODE_SECONDS: Record<QuizMode, number> = {
  full: 3 * 60 * 60,
  mixed: 60 * 60,
  domain: 25 * 60,
  misses: 25 * 60,
};

/** Pass mark, or null where the mode does not have one. */
export function targetScorePct(mode: QuizMode): number | null {
  return mode === "full" ? 70 : null;
}

const MODE_LABELS: Record<QuizMode, string> = {
  domain: "Domain Drill",
  mixed: "Mixed Set",
  full: "Full Exam",
  misses: "Retry Misses",
};

/**
 * Human label for a run. Shared because it was written inline in two places
 * that disagreed the moment a fourth mode existed: the study report fell
 * through to "Mixed" and the session header to "Domain null".
 */
export function describeMode(mode: QuizMode, domainId: number | null = null): string {
  if (mode === "domain" && domainId) return `Domain ${domainId}`;
  return MODE_LABELS[mode];
}

/**
 * Fisher-Yates over a copy. Takes the RNG so tests can pin the order — same
 * shape as src/features/vault/quickTest.ts, which was already extracted.
 */
export function shuffle<T>(arr: readonly T[], rng: () => number = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Selects the question set for a run.
 *
 * `domainId` only filters in "domain" mode; mixed, full and misses deliberately
 * ignore it so a stale query parameter cannot narrow a full exam to one domain.
 *
 * In "misses" mode the caller has already resolved which questions are due from
 * `questionReviews` and passes that subset as `pool` — this stays a pure
 * function over whatever it is given.
 */
export function pickQuestions(
  pool: readonly Question[],
  mode: QuizMode,
  domainId: number | null,
  rng: () => number = Math.random,
): Question[] {
  const eligible = mode === "domain" && domainId ? pool.filter((q) => q.domainId === domainId) : pool;
  return shuffle(eligible, rng).slice(0, Math.min(eligible.length, MODE_LIMITS[mode]));
}

/**
 * Percentage correct.
 *
 * Divides by the questions served, not the answers given, so a timed-out exam
 * scores every unreached question wrong. That is the intended behaviour for a
 * timed exam simulation — the clock running out is a result, not an
 * interruption — but it was undocumented and untested, so it read like an
 * off-by-one waiting to be "fixed".
 */
export function scoreQuiz(
  answers: readonly Pick<QuizAnswer, "correct">[],
  questionCount: number,
): { score: number; scorePct: number } {
  const score = answers.filter((a) => a.correct).length;
  if (questionCount <= 0) return { score, scorePct: 0 };
  return { score, scorePct: Math.round((score / questionCount) * 100) };
}

/** Whether a run met its target. Null when the mode has no pass mark. */
export function didPass(scorePct: number, mode: QuizMode): boolean | null {
  const target = targetScorePct(mode);
  return target === null ? null : scorePct >= target;
}

export type CisoCounters = Pick<
  Profile,
  "mindsetChoicesCorrect" | "technicianMisses" | "speedReaderMisses"
>;

/**
 * The profile counter deltas for a single submitted answer.
 *
 * Note the asymmetry, which is deliberate and worth asserting rather than
 * discovering: `technicianMisses` increments whenever the answer was the
 * technician's pick — including when that pick was also the correct one,
 * because reaching for the technical fix first is the habit being measured.
 * `speedReaderMisses` requires an actual miss, because answering quickly and
 * correctly is not a problem.
 */
export function cisoCounterPatch(
  current: CisoCounters,
  outcome: { isMindsetHeavy: boolean; correct: boolean; technician: boolean; speedy: boolean },
): Partial<CisoCounters> {
  const patch: Partial<CisoCounters> = {};
  if (outcome.isMindsetHeavy && outcome.correct) {
    patch.mindsetChoicesCorrect = current.mindsetChoicesCorrect + 1;
  }
  if (outcome.technician) patch.technicianMisses = current.technicianMisses + 1;
  if (outcome.speedy && !outcome.correct) patch.speedReaderMisses = current.speedReaderMisses + 1;
  return patch;
}
