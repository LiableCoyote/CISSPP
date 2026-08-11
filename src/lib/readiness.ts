import { differenceInCalendarDays, parseISO } from "date-fns";
import type { QuizAnswer, QuizAttempt } from "../db/schema";
import { DOMAINS } from "../data/domains";
import { domainAverages } from "./campaign";

/**
 * An honest readiness estimate.
 *
 * The easiest thing in this file to get wrong is not the arithmetic — it is
 * overstating what the arithmetic knows. Someone books an expensive exam on the
 * back of a number like this, so every path either reports its own uncertainty
 * or refuses to answer.
 *
 * Three rules the UI depends on:
 *   1. Mastery is weighted by the real exam weights, not averaged flat.
 *   2. Confidence degrades with coverage, and thin domains are named.
 *   3. A projection needs at least MIN_TREND_POINTS; two points is a line
 *      through noise, not a trend.
 */

/** Answers in a domain below which its average is noise rather than signal. */
export const MIN_DOMAIN_COVERAGE = 20;
/** Distinct scored days needed before any projection is drawn. */
export const MIN_TREND_POINTS = 3;
/** Days of history the trend line looks back over. */
export const TREND_WINDOW_DAYS = 14;

/** The pass mark the full exam scores against. */
export const PASS_MARK = 70;

export type ReadinessBand = "not-ready" | "borderline" | "on-track";
export type ReadinessConfidence = "low" | "medium" | "high";

export type Readiness = {
  /** Exam-weighted mastery, 0-100. */
  scorePct: number;
  band: ReadinessBand;
  confidence: ReadinessConfidence;
  /** Plain-language limits on the number above. Never render it without these. */
  caveats: string[];
  /** Domains with too few answers for their average to mean anything. */
  thinDomains: number[];
  /** Domains with no scored attempt at all. */
  untestedDomains: number[];
};

/**
 * Mastery weighted by each domain's real share of the exam.
 *
 * A flat average overstates readiness for anyone strong in the light domains:
 * Security & Risk Management is 15% of the exam and Software Development
 * Security is 10%, so treating them equally quietly misprices the whole
 * estimate. Domains with no attempts score 0 — an untested domain is not a
 * neutral one, and dropping it from the denominator would let someone reach
 * "on-track" having studied two domains.
 */
export function weightedMastery(attempts: QuizAttempt[]): number {
  const averages = domainAverages(attempts);
  const totalWeight = DOMAINS.reduce((s, d) => s + d.weight, 0);
  if (totalWeight === 0) return 0;
  const weighted = DOMAINS.reduce((s, d) => s + (averages.get(d.id) ?? 0) * d.weight, 0);
  return Math.round(weighted / totalWeight);
}

/** Answers per domain, used to judge how much the averages can be trusted. */
export function coverageByDomain(
  answers: readonly QuizAnswer[],
  domainOf: (questionId: string) => number | undefined,
): Map<number, number> {
  const out = new Map<number, number>();
  for (const d of DOMAINS) out.set(d.id, 0);
  for (const a of answers) {
    const d = domainOf(a.questionId);
    if (d !== undefined) out.set(d, (out.get(d) ?? 0) + 1);
  }
  return out;
}

function band(scorePct: number): ReadinessBand {
  if (scorePct >= PASS_MARK) return "on-track";
  if (scorePct >= PASS_MARK - 10) return "borderline";
  return "not-ready";
}

/**
 * Readiness, with its own uncertainty attached.
 *
 * `caveats` is not decoration. A score of 74% built on two domains means
 * something very different from the same number built on eight, and the UI
 * contract is that the number never appears without them.
 */
export function readiness(
  attempts: QuizAttempt[],
  coverage: Map<number, number>,
): Readiness {
  const scorePct = weightedMastery(attempts);
  const finished = attempts.filter((a) => a.finishedAt);

  const untestedDomains = DOMAINS.filter(
    (d) => !finished.some((a) => a.domainId === d.id),
  ).map((d) => d.id);

  const thinDomains = DOMAINS.filter((d) => {
    if (untestedDomains.includes(d.id)) return false;
    return (coverage.get(d.id) ?? 0) < MIN_DOMAIN_COVERAGE;
  }).map((d) => d.id);

  const caveats: string[] = [];
  if (finished.length === 0) {
    caveats.push("No completed quizzes yet — this is a floor, not an estimate.");
  }
  if (untestedDomains.length > 0) {
    caveats.push(
      `${untestedDomains.length} domain${untestedDomains.length === 1 ? "" : "s"} untested (${untestedDomains
        .map((d) => `D${d}`)
        .join(", ")}). They count as zero, which is why this reads low.`,
    );
  }
  if (thinDomains.length > 0) {
    const list = thinDomains.map((d) => `D${d}`).join(", ");
    caveats.push(
      thinDomains.length === 1
        ? `Thin coverage in ${list} — under ${MIN_DOMAIN_COVERAGE} answers, so that average moves a lot.`
        : `Thin coverage in ${list} — under ${MIN_DOMAIN_COVERAGE} answers each, so those averages move a lot.`,
    );
  }
  caveats.push(
    "Measured against your own practice questions, which are not the real exam's difficulty or adaptive scoring.",
  );

  // Confidence is about how much of the picture exists, not how good it looks.
  let confidence: ReadinessConfidence;
  if (untestedDomains.length > 2 || finished.length < 3) {
    confidence = "low";
  } else if (untestedDomains.length > 0 || thinDomains.length > 2) {
    confidence = "medium";
  } else {
    confidence = "high";
  }

  return { scorePct, band: band(scorePct), confidence, caveats, thinDomains, untestedDomains };
}

export type Projection = {
  /** Extrapolated weighted mastery on exam day, clamped to 0-100. */
  projectedPct: number;
  /** Points per day, from the fitted line. */
  perDay: number;
  daysRemaining: number;
};

/**
 * Straight-line extrapolation of recent scores to exam day, or null.
 *
 * Returns null rather than guessing when there is no exam date, when the exam
 * has passed, or when fewer than MIN_TREND_POINTS distinct days carry a score.
 * Drawing a line through two points and calling it a forecast is the single
 * most misleading thing this file could do.
 *
 * This is a naive least-squares fit on recent attempts, nothing more. It cannot
 * know that progress plateaus, and the UI must present it as a trend line
 * rather than a prediction.
 */
export function projectReadiness(
  attempts: QuizAttempt[],
  examDate: string | null,
  now: Date = new Date(),
): Projection | null {
  if (!examDate) return null;
  const daysRemaining = differenceInCalendarDays(parseISO(examDate), now);
  if (daysRemaining <= 0) return null;

  const recent = attempts.filter((a) => {
    if (!a.finishedAt) return false;
    const age = differenceInCalendarDays(now, parseISO(a.startedAt));
    return age >= 0 && age <= TREND_WINDOW_DAYS;
  });

  // One point per day, so a day with six quizzes doesn't outvote a week.
  const byDay = new Map<number, number[]>();
  for (const a of recent) {
    const day = differenceInCalendarDays(now, parseISO(a.startedAt));
    byDay.set(day, [...(byDay.get(day) ?? []), a.scorePct]);
  }
  if (byDay.size < MIN_TREND_POINTS) return null;

  // x runs forward in time: -14 is a fortnight ago, 0 is today.
  const points = [...byDay.entries()].map(([daysAgo, scores]) => ({
    x: -daysAgo,
    y: scores.reduce((s, v) => s + v, 0) / scores.length,
  }));

  const n = points.length;
  const meanX = points.reduce((s, p) => s + p.x, 0) / n;
  const meanY = points.reduce((s, p) => s + p.y, 0) / n;
  const varX = points.reduce((s, p) => s + (p.x - meanX) ** 2, 0);
  // Every attempt on the same day: a slope is undefined, so decline to fit one.
  if (varX === 0) return null;
  const slope = points.reduce((s, p) => s + (p.x - meanX) * (p.y - meanY), 0) / varX;
  const intercept = meanY - slope * meanX;

  const raw = intercept + slope * daysRemaining;
  return {
    projectedPct: Math.max(0, Math.min(100, Math.round(raw))),
    perDay: Math.round(slope * 10) / 10,
    daysRemaining,
  };
}
