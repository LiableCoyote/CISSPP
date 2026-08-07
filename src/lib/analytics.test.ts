import { describe, it, expect } from "vitest";
import { subDays, format } from "date-fns";
import type { DomainId, QuizAttempt, StudyDay } from "../db/schema";
import {
  buildMasteryTrend,
  buildDomainVelocity,
  buildTimeline,
  describeStudyPattern,
  buildWeeklySummary,
  weeklyHeadline,
  detectStudySignals,
} from "./analytics";

// A fixed instant. Fixtures and the code under test each used to call
// new Date() independently, so a run crossing midnight could disagree with
// itself. Every function under test now accepts the clock as a parameter.
const NOW = new Date("2026-06-15T12:00:00Z");
const iso = (daysAgo: number) => subDays(NOW, daysAgo).toISOString();
const day = (daysAgo: number) => format(subDays(NOW, daysAgo), "yyyy-MM-dd");

function attempt(
  id: string,
  domainId: DomainId | null,
  daysAgo: number,
  scorePct: number,
  mode: QuizAttempt["mode"] = "domain",
): QuizAttempt {
  return {
    id,
    mode,
    domainId,
    questionIds: [],
    startedAt: iso(daysAgo),
    finishedAt: iso(daysAgo),
    totalSeconds: 600,
    score: scorePct,
    scorePct,
    passed: null,
    targetScorePct: null,
  };
}

function logDay(daysAgo: number, minutes: number, cards = 0): StudyDay {
  return {
    date: day(daysAgo),
    minutes,
    sessions: 1,
    questsCompleted: 0,
    flashcardsReviewed: cards,
  };
}

describe("buildMasteryTrend", () => {
  it("returns a cumulative average per domain", () => {
    const trend = buildMasteryTrend([
      attempt("a", 3, 20, 40),
      attempt("b", 3, 12, 60),
      attempt("c", 3, 2, 80),
    ]);
    expect(trend).toHaveLength(3);
    expect(trend.at(-1)?.d3).toBe(60); // (40+60+80)/3
  });

  it("leaves a domain undefined before its first attempt", () => {
    const trend = buildMasteryTrend([attempt("a", 3, 20, 40), attempt("b", 5, 2, 90)]);
    expect(trend[0].d5).toBeUndefined();
    expect(trend.at(-1)?.d5).toBe(90);
  });

  it("returns nothing when there are no scored attempts", () => {
    expect(buildMasteryTrend([])).toEqual([]);
  });
});

describe("buildDomainVelocity", () => {
  it("reports a positive delta for an improving domain", () => {
    const v = buildDomainVelocity([
      attempt("a", 3, 20, 40),
      attempt("b", 3, 12, 60),
      attempt("c", 3, 2, 80),
    ], 7, NOW).find((d) => d.id === 3)!;
    expect(v.delta).toBeGreaterThan(0);
    expect(v.stagnant).toBe(false);
  });

  it("flags a domain drilled recently with no gain as stagnant", () => {
    const v = buildDomainVelocity([
      attempt("a", 5, 20, 55),
      attempt("b", 5, 4, 55),
      attempt("c", 5, 1, 55),
    ], 7, NOW).find((d) => d.id === 5)!;
    expect(v.delta).toBe(0);
    expect(v.stagnant).toBe(true);
  });

  it("reports no movement rather than a fake jump when there is no baseline", () => {
    const v = buildDomainVelocity([attempt("a", 2, 1, 90)], 7, NOW).find((d) => d.id === 2)!;
    expect(v.delta).toBe(0);
    expect(v.stagnant).toBe(false);
  });

  it("handles no attempts at all", () => {
    expect(buildDomainVelocity([], 7, NOW).every((v) => v.attempts === 0 && v.delta === 0)).toBe(true);
  });
});

describe("buildTimeline / describeStudyPattern", () => {
  it("covers the requested window and marks today", () => {
    const tl = buildTimeline([logDay(0, 60)], [], 30, NOW);
    expect(tl).toHaveLength(30);
    expect(tl.at(-1)?.isToday).toBe(true);
    expect(tl.at(-1)?.minutes).toBe(60);
  });

  it("declines to describe a pattern from too few active days", () => {
    expect(describeStudyPattern(buildTimeline([logDay(0, 60)], [], 30, NOW))).toBeNull();
  });

  it("describes a pattern once there is enough data", () => {
    const logs = [0, 1, 2, 3, 4, 5].map((d) => logDay(d, 60));
    expect(describeStudyPattern(buildTimeline(logs, [], 30, NOW))).toMatch(/study/i);
  });
});

describe("buildWeeklySummary", () => {
  it("computes deltas against the preceding window", () => {
    const logs = [logDay(1, 60, 20), logDay(3, 40, 15), logDay(9, 30, 12)];
    const attempts = [attempt("a", 1, 1, 80), attempt("b", 1, 9, 60)];
    const s = buildWeeklySummary({ studyLog: logs, attempts, unlockedAt: [], now: NOW });
    expect(s.minutes).toBe(100);
    expect(s.minutesDelta).toBe(70); // 100 this week vs 30 last
    expect(s.quizzes).toBe(1);
    expect(s.avgScore).toBe(80);
    expect(s.scoreDelta).toBe(20); // 80 vs 60
  });

  it("returns a null score delta when a window has no attempts", () => {
    const s = buildWeeklySummary({ studyLog: [logDay(1, 60)], attempts: [], unlockedAt: [], now: NOW });
    expect(s.avgScore).toBeNull();
    expect(s.scoreDelta).toBeNull();
  });

  it("survives entirely empty input", () => {
    const s = buildWeeklySummary({ studyLog: [], attempts: [], unlockedAt: [], now: NOW });
    expect(s.minutes).toBe(0);
    expect(s.activeDays).toBe(0);
    expect(weeklyHeadline(s, 0)).toMatch(/quiet/i);
  });
});

describe("detectStudySignals", () => {
  const none = { studyLog: [], attempts: [], lastActiveDate: null, streak: 0, overdueCards: 0, now: NOW };
  const ids = (s: ReturnType<typeof detectStudySignals>) => s.map((x) => x.id);

  it("stays quiet for a healthy pattern", () => {
    expect(
      detectStudySignals({ ...none, studyLog: [logDay(0, 45)], lastActiveDate: day(0) }),
    ).toEqual([]);
  });

  it("flags a long single-day session as cramming", () => {
    const s = detectStudySignals({ ...none, studyLog: [logDay(0, 200)], lastActiveDate: day(0) });
    expect(ids(s)).toContain("cramming");
  });

  it("flags three low scores in a row", () => {
    const s = detectStudySignals({
      ...none,
      attempts: [attempt("a", 1, 0, 45), attempt("b", 1, 1, 50), attempt("c", 1, 2, 40)],
      lastActiveDate: day(0),
    });
    expect(ids(s)).toContain("struggling");
  });

  it("flags dormancy", () => {
    expect(ids(detectStudySignals({ ...none, lastActiveDate: day(5), streak: 9 }))).toContain(
      "dormant",
    );
  });

  it("flags an SRS backlog", () => {
    expect(
      ids(detectStudySignals({ ...none, lastActiveDate: day(0), overdueCards: 55 })),
    ).toContain("backlog");
  });

  it("flags marathon drilling of one domain", () => {
    const attempts = Array.from({ length: 6 }, (_, i) => attempt(`a${i}`, 5, i % 2, 70));
    expect(ids(detectStudySignals({ ...none, attempts, lastActiveDate: day(0) }))).toContain(
      "domain-cram",
    );
  });

  // Regression: the de-dup guard compared against "top domain of the last two
  // days" whether or not it met the cram threshold, so a single recent attempt
  // silently suppressed the hoard banner — the common hoarding case.
  it("still flags hoarding when a domain dominates the week without cramming", () => {
    const attempts = [
      attempt("a", 3, 1, 70), // one attempt in the last 2 days — below the cram threshold
      attempt("b", 3, 4, 70),
      attempt("c", 3, 5, 70),
      attempt("d", 1, 6, 70),
    ];
    const s = detectStudySignals({ ...none, attempts, lastActiveDate: day(0) });
    expect(ids(s)).not.toContain("domain-cram");
    expect(ids(s)).toContain("domain-hoard");
  });

  it("does not double-report the same domain as both crammed and hoarded", () => {
    const attempts = Array.from({ length: 7 }, (_, i) => attempt(`a${i}`, 4, i % 2, 70));
    const s = detectStudySignals({ ...none, attempts, lastActiveDate: day(0) });
    expect(ids(s)).toContain("domain-cram");
    expect(ids(s)).not.toContain("domain-hoard");
  });

  it("ignores unfinished attempts", () => {
    const abandoned = Array.from({ length: 6 }, (_, i) => ({
      ...attempt(`x${i}`, 6, 0, 0),
      finishedAt: null,
    }));
    const s = detectStudySignals({ ...none, attempts: abandoned, lastActiveDate: day(0) });
    expect(ids(s)).not.toContain("domain-cram");
  });

  it("handles a profile that has never studied", () => {
    expect(() => detectStudySignals(none)).not.toThrow();
  });
});

describe("weeklyHeadline", () => {
  // Eight return branches; only the quiet-week one was covered.
  const base = {
    minutes: 0, quizzes: 0, cards: 0, quests: 0, activeDays: 3,
    achievements: 0, avgScore: null as number | null,
    minutesDelta: 0, quizzesDelta: 0, cardsDelta: 0, scoreDelta: null as number | null,
  };

  it("leads with a quiet week when nothing happened", () => {
    expect(weeklyHeadline({ ...base, activeDays: 0 }, 0)).toMatch(/quiet/i);
  });

  it("leads with a score gain", () => {
    expect(weeklyHeadline({ ...base, scoreDelta: 8 }, 0)).toMatch(/up 8 points/i);
  });

  it("leads with a score dip", () => {
    expect(weeklyHeadline({ ...base, scoreDelta: -9 }, 0)).toMatch(/dipped/i);
  });

  it("celebrates a long streak", () => {
    expect(weeklyHeadline(base, 21)).toMatch(/21 days straight/i);
  });

  it("mentions multiple achievements", () => {
    expect(weeklyHeadline({ ...base, achievements: 3 }, 0)).toMatch(/3 achievements/i);
  });

  it("mentions extra minutes", () => {
    expect(weeklyHeadline({ ...base, minutesDelta: 45 }, 0)).toMatch(/45 minutes/i);
  });

  it("praises consistency", () => {
    expect(weeklyHeadline({ ...base, activeDays: 6 }, 0)).toMatch(/6 active days/i);
  });

  it("pluralises the fallback correctly", () => {
    expect(weeklyHeadline({ ...base, activeDays: 1 }, 0)).toMatch(/1 active day\b/);
    expect(weeklyHeadline({ ...base, activeDays: 2 }, 0)).toMatch(/2 active days/);
  });

  it("always returns something non-empty", () => {
    expect(weeklyHeadline(base, 0).length).toBeGreaterThan(0);
  });
});
