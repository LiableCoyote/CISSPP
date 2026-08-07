import { describe, it, expect } from "vitest";
import { subDays, addDays, format } from "date-fns";
import type { DomainId, Profile, QuizAttempt } from "../db/schema";
import { campaignPosition, daysUntilExam, domainAverages, domainsMastered } from "./campaign";

const NOW = new Date("2026-06-15T12:00:00Z");

function profileAt(startDaysAgo: number, examDate: string | null = null): Profile {
  return {
    id: 1,
    displayName: "T",
    examDate,
    dailyGoalMinutes: 120,
    startDate: subDays(NOW, startDaysAgo).toISOString(),
    xp: 0,
    level: 0,
    streak: 0,
    longestStreak: 0,
    streakFreezesUsedThisWeek: 0,
    streakWeekKey: "",
    lastActiveDate: null,
    mindsetChoicesCorrect: 0,
    technicianMisses: 0,
    speedReaderMisses: 0,
    createdAt: subDays(NOW, startDaysAgo).toISOString(),
  };
}

function attempt(
  domainId: DomainId | null,
  scorePct: number,
  finished = true,
): QuizAttempt {
  return {
    id: `a-${Math.abs(scorePct)}-${domainId}-${finished}`,
    mode: "domain",
    domainId,
    questionIds: [],
    startedAt: NOW.toISOString(),
    finishedAt: finished ? NOW.toISOString() : null,
    totalSeconds: 60,
    score: scorePct,
    scorePct,
    passed: null,
    targetScorePct: null,
  };
}

describe("daysUntilExam", () => {
  it("counts calendar days, not 24-hour spans", () => {
    // Header used Math.ceil on a millisecond division and could disagree with
    // the Dashboard while both were on screen.
    const exam = format(addDays(NOW, 10), "yyyy-MM-dd");
    expect(daysUntilExam(profileAt(0, exam), NOW)).toBe(10);
  });

  it("returns null when no exam date is set", () => {
    expect(daysUntilExam(profileAt(0, null), NOW)).toBeNull();
  });

  it("goes negative once the date has passed", () => {
    const past = format(subDays(NOW, 3), "yyyy-MM-dd");
    expect(daysUntilExam(profileAt(0, past), NOW)).toBe(-3);
  });
});

describe("campaignPosition", () => {
  it.each([
    [0, 1, 1],
    [1, 1, 2],
    [6, 1, 7],
    [7, 2, 1],
    [13, 2, 7],
    [49, 8, 1],
  ])("day %i of the plan is week %i day %i", (daysAgo, week, day) => {
    const pos = campaignPosition(profileAt(daysAgo), NOW);
    expect(pos.week).toBe(week);
    expect(pos.day).toBe(day);
  });

  it("clamps past the end of the campaign", () => {
    expect(campaignPosition(profileAt(200), NOW).week).toBe(8);
  });

  it("never goes below week 1 for a future start date", () => {
    const future = profileAt(-5); // startDate in the future
    const pos = campaignPosition(future, NOW);
    expect(pos.week).toBe(1);
    expect(pos.day).toBeGreaterThanOrEqual(1);
  });
});

describe("domainAverages", () => {
  it("averages only completed attempts", () => {
    // Three of the five components that computed this omitted the finishedAt
    // filter, so an abandoned quiz pulled their numbers off the Stats figure.
    const avgs = domainAverages([attempt(1, 80), attempt(1, 0, false)]);
    expect(avgs.get(1)).toBe(80);
  });

  it("reports 0 for a domain with no attempts", () => {
    expect(domainAverages([]).get(3)).toBe(0);
  });

  it("ignores mixed and full attempts, which carry no domain", () => {
    expect(domainAverages([attempt(null, 90)]).get(1)).toBe(0);
  });
});

describe("domainsMastered", () => {
  it("counts domains at or above the threshold", () => {
    expect(domainsMastered([attempt(1, 70), attempt(2, 69)])).toBe(1);
  });

  it("respects a custom threshold", () => {
    expect(domainsMastered([attempt(1, 65)], 60)).toBe(1);
  });

  it("is zero with no attempts", () => {
    expect(domainsMastered([])).toBe(0);
  });
});
