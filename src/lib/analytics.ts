import { differenceInCalendarDays, format, parseISO, subDays } from "date-fns";
import type { DomainId, QuizAttempt, StudyDay } from "../db/schema";
import { DOMAINS } from "../data/domains";

/**
 * Pure analytics over Dexie rows. Kept free of React and Dexie so the same
 * computation backs the Stats charts, the Dashboard banners and the share card.
 */

/** Cumulative average score per domain, sampled on every date that had an attempt. */
export type MasteryPoint = { date: string; label: string } & Partial<Record<`d${DomainId}`, number>>;

export type DomainVelocity = {
  id: DomainId;
  name: string;
  accent: string;
  /** Cumulative average score across all attempts, 0 if never attempted. */
  current: number;
  /** Same measure as of `windowDays` ago. */
  previous: number;
  delta: number;
  attempts: number;
  /** Attempted recently but not moving — the signal that drilling isn't working. */
  stagnant: boolean;
};

function cumulativeAvgAt(attempts: QuizAttempt[], cutoff: Date): number {
  const upTo = attempts.filter((a) => parseISO(a.startedAt) <= cutoff);
  if (upTo.length === 0) return 0;
  return Math.round(upTo.reduce((s, a) => s + a.scorePct, 0) / upTo.length);
}

/**
 * Per-domain learning curve. Each point carries every domain's cumulative
 * average as of that date, so Recharts can draw one line per domain.
 */
export function buildMasteryTrend(attempts: QuizAttempt[]): MasteryPoint[] {
  const scored = attempts
    .filter((a) => a.finishedAt && a.domainId !== null)
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  if (scored.length === 0) return [];

  const dates = [...new Set(scored.map((a) => format(parseISO(a.startedAt), "yyyy-MM-dd")))].sort();

  return dates.map((date) => {
    // End of day, so same-day attempts are all included at their own point.
    const cutoff = parseISO(`${date}T23:59:59`);
    const point: MasteryPoint = { date, label: format(parseISO(date), "MMM d") };
    for (const d of DOMAINS) {
      const domainAttempts = scored.filter((a) => a.domainId === d.id);
      const anyBefore = domainAttempts.some((a) => parseISO(a.startedAt) <= cutoff);
      // Leave untouched domains undefined so the line starts at first attempt.
      if (anyBefore) point[`d${d.id}`] = cumulativeAvgAt(domainAttempts, cutoff);
    }
    return point;
  });
}

export function buildDomainVelocity(attempts: QuizAttempt[], windowDays = 7): DomainVelocity[] {
  const now = new Date();
  const past = subDays(now, windowDays);

  return DOMAINS.map((d) => {
    const domainAttempts = attempts
      .filter((a) => a.finishedAt && a.domainId === d.id)
      .sort((a, b) => a.startedAt.localeCompare(b.startedAt));

    const current = cumulativeAvgAt(domainAttempts, now);
    const previous = cumulativeAvgAt(domainAttempts, past);
    const recent = domainAttempts.filter((a) => parseISO(a.startedAt) > past).length;

    return {
      id: d.id,
      name: d.name,
      accent: d.accent,
      current,
      previous,
      // A domain with no prior baseline hasn't "moved" — report 0, not a fake jump.
      delta: previous > 0 ? current - previous : 0,
      attempts: domainAttempts.length,
      stagnant: previous > 0 && recent >= 2 && current - previous <= 0,
    };
  });
}

/* ───────────────────────────── Session timeline ───────────────────────────── */

export type TimelineDay = {
  date: string;
  label: string;
  weekday: string;
  minutes: number;
  sessions: number;
  questsCompleted: number;
  flashcardsReviewed: number;
  quizzes: number;
  /** Average quiz score that day, null when no quiz was taken. */
  avgScore: number | null;
  isToday: boolean;
};

export function buildTimeline(
  studyLog: StudyDay[],
  attempts: QuizAttempt[],
  windowDays = 30,
): TimelineDay[] {
  const today = new Date();
  const logByDate = new Map(studyLog.map((l) => [l.date, l]));

  const out: TimelineDay[] = [];
  for (let i = windowDays - 1; i >= 0; i--) {
    const d = subDays(today, i);
    const date = format(d, "yyyy-MM-dd");
    const log = logByDate.get(date);
    const dayAttempts = attempts.filter(
      (a) => a.finishedAt && format(parseISO(a.startedAt), "yyyy-MM-dd") === date,
    );
    out.push({
      date,
      label: format(d, "MMM d"),
      weekday: format(d, "EEE"),
      minutes: log?.minutes || 0,
      sessions: log?.sessions || 0,
      questsCompleted: log?.questsCompleted || 0,
      flashcardsReviewed: log?.flashcardsReviewed || 0,
      quizzes: dayAttempts.length,
      avgScore:
        dayAttempts.length > 0
          ? Math.round(dayAttempts.reduce((s, a) => s + a.scorePct, 0) / dayAttempts.length)
          : null,
      isToday: i === 0,
    });
  }
  return out;
}

/** Plain-language read of when the user actually studies. */
export function describeStudyPattern(timeline: TimelineDay[]): string | null {
  const active = timeline.filter((d) => d.minutes > 0 || d.quizzes > 0);
  if (active.length < 5) return null;

  const byWeekday = new Map<string, number>();
  for (const d of active) byWeekday.set(d.weekday, (byWeekday.get(d.weekday) || 0) + d.minutes);
  const best = [...byWeekday.entries()].sort((a, b) => b[1] - a[1])[0];

  const avgMinutes = Math.round(active.reduce((s, d) => s + d.minutes, 0) / active.length);
  const consistency = Math.round((active.length / timeline.length) * 100);

  return `You study ${consistency}% of days, averaging ${avgMinutes} min per active day. ${best[0]} is your heaviest day.`;
}

/* ───────────────────────── Fatigue & risk detection ───────────────────────── */

export type StudySignal = {
  id: "cramming" | "struggling" | "dormant" | "backlog" | "domain-cram" | "domain-hoard";
  severity: "warn" | "danger" | "info";
  icon: string;
  title: string;
  body: string;
  /** Optional deep link for the suggested next action. */
  to?: string;
  actionLabel?: string;
};

const CRAM_QUIZZES_PER_DAY = 6;
const CRAM_MINUTES_PER_DAY = 180;
const STRUGGLE_RUN = 3;
const STRUGGLE_PCT = 60;
const DORMANT_DAYS = 3;
const BACKLOG_CARDS = 40;
const DOMAIN_CRAM_ATTEMPTS = 6;
const HOARD_SHARE = 0.6;

/** Counts attempts per domain within the last `days`. */
function attemptsByDomain(attempts: QuizAttempt[], days: number): Map<DomainId, number> {
  const now = new Date();
  const counts = new Map<DomainId, number>();
  for (const a of attempts) {
    if (a.domainId === null) continue;
    if (differenceInCalendarDays(now, parseISO(a.startedAt)) > days) continue;
    counts.set(a.domainId, (counts.get(a.domainId) || 0) + 1);
  }
  return counts;
}

/**
 * Surfaces unsustainable or unproductive study patterns. Returned as data so the
 * caller decides how to present them — these are rendered as dismissible banners
 * rather than toasts, since a toast on every dashboard visit is noise.
 */
export function detectStudySignals(opts: {
  studyLog: StudyDay[];
  attempts: QuizAttempt[];
  lastActiveDate: string | null;
  streak: number;
  overdueCards: number;
}): StudySignal[] {
  const { studyLog, attempts, lastActiveDate, streak, overdueCards } = opts;
  const signals: StudySignal[] = [];
  const today = new Date();
  const todayKey = format(today, "yyyy-MM-dd");

  // Cramming — too much crammed into one day.
  const todayLog = studyLog.find((l) => l.date === todayKey);
  const todayQuizzes = attempts.filter(
    (a) => a.finishedAt && format(parseISO(a.startedAt), "yyyy-MM-dd") === todayKey,
  ).length;
  const todayMinutes = todayLog?.minutes || 0;
  if (todayQuizzes >= CRAM_QUIZZES_PER_DAY || todayMinutes >= CRAM_MINUTES_PER_DAY) {
    signals.push({
      id: "cramming",
      severity: "warn",
      icon: "🛑",
      title: "You're cramming",
      body:
        todayQuizzes >= CRAM_QUIZZES_PER_DAY
          ? `${todayQuizzes} quizzes today. Retention drops hard past this point — stop and let spaced repetition do the work tomorrow.`
          : `${todayMinutes} minutes today. Long sessions feel productive and retain poorly. Take the rest of the day off.`,
    });
  }

  // Struggling — a run of low scores means the approach isn't working.
  const finished = attempts
    .filter((a) => a.finishedAt)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const lastRun = finished.slice(0, STRUGGLE_RUN);
  if (lastRun.length === STRUGGLE_RUN && lastRun.every((a) => a.scorePct < STRUGGLE_PCT)) {
    signals.push({
      id: "struggling",
      severity: "danger",
      icon: "📉",
      title: "Three low scores in a row",
      body: "More quizzes won't fix this. Go back to flashcards and the Vault for the weak material, then retest.",
      to: "/flashcards",
      actionLabel: "Review flashcards",
    });
  }

  // Dormant — streak already broken or about to.
  if (lastActiveDate) {
    const gap = differenceInCalendarDays(today, parseISO(lastActiveDate));
    if (gap >= DORMANT_DAYS) {
      signals.push({
        id: "dormant",
        severity: "warn",
        icon: "⏰",
        title: gap >= 7 ? `${gap} days away` : "Streak at risk",
        body:
          streak > 0
            ? `Your ${streak}-day streak is on the line. One short session today keeps it alive.`
            : `No study for ${gap} days. Start small — one 10-minute drill beats planning a perfect session.`,
        to: "/quiz",
        actionLabel: "Quick quiz",
      });
    }
  }

  // Marathon drilling one domain — beats spaced repetition into the ground.
  const cram2d = attemptsByDomain(attempts, 2);
  const crammedDomain = [...cram2d.entries()].sort((a, b) => b[1] - a[1])[0];
  if (crammedDomain && crammedDomain[1] >= DOMAIN_CRAM_ATTEMPTS) {
    const [domainId, count] = crammedDomain;
    signals.push({
      id: "domain-cram",
      severity: "warn",
      icon: "⏱",
      title: `${count} quizzes on D${domainId} in 2 days`,
      body: "Marathon drilling one domain has diminishing returns. Switch to a mixed set or flashcards tomorrow.",
      to: "/quiz/session?mode=mixed",
      actionLabel: "Mixed quiz",
    });
  }

  // Over-indexing on one domain across the week leaves the others untested.
  const week = attemptsByDomain(attempts, 7);
  const weekTotal = [...week.values()].reduce((s, n) => s + n, 0);
  const topDomain = [...week.entries()].sort((a, b) => b[1] - a[1])[0];
  if (
    topDomain &&
    weekTotal >= 3 &&
    topDomain[1] / weekTotal > HOARD_SHARE &&
    topDomain[0] !== crammedDomain?.[0]
  ) {
    const share = Math.round((topDomain[1] / weekTotal) * 100);
    signals.push({
      id: "domain-hoard",
      severity: "warn",
      icon: "⚖️",
      title: `${share}% of this week was D${topDomain[0]}`,
      body: `${DOMAINS.find((d) => d.id === topDomain[0])?.name ?? "That domain"} is dominating your practice. Rotate so the other domains don't go stale.`,
      to: "/quiz",
      actionLabel: "Pick another domain",
    });
  }

  // Backlog — SRS only works if you keep up with it.
  if (overdueCards >= BACKLOG_CARDS) {
    signals.push({
      id: "backlog",
      severity: "info",
      icon: "🗂️",
      title: `${overdueCards} cards overdue`,
      body: "Spaced repetition stops working once the backlog grows. Clear these before adding new material.",
      to: "/flashcards/review",
      actionLabel: "Start review",
    });
  }

  return signals;
}
