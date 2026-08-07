import { describe, it, expect } from "vitest";
import { subDays, format } from "date-fns";
import type { DomainId, Profile, Quest, QuizAttempt } from "../db/schema";
import { buildDomainVelocity } from "./analytics";
import { buildRecommendations, type RecommendationInput } from "./recommendations";

const iso = (daysAgo: number) => subDays(new Date(), daysAgo).toISOString();
const day = (daysAgo: number) => format(subDays(new Date(), daysAgo), "yyyy-MM-dd");

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

const profile: Profile = {
  id: 1,
  displayName: "T",
  examDate: null,
  dailyGoalMinutes: 120,
  startDate: iso(30),
  xp: 3000,
  streak: 5,
  longestStreak: 9,
  streakFreezesUsedThisWeek: 0,
  streakWeekKey: "",
  lastActiveDate: day(1),
  mindsetChoicesCorrect: 2,
  technicianMisses: 0,
  speedReaderMisses: 0,
  createdAt: iso(30),
};

const quest = (completed: boolean): Quest => ({
  id: "q1",
  week: 5,
  day: 2,
  title: "Read",
  description: "",
  domainIds: [],
  xp: 50,
  type: "read",
  completedAt: completed ? iso(0) : null,
  minutesLogged: 0,
});

function input(over: Partial<RecommendationInput> = {}): RecommendationInput {
  const attempts = over.attempts ?? [];
  return {
    profile,
    attempts,
    quests: [],
    velocity: buildDomainVelocity(attempts),
    dueCards: 0,
    overdueCards: 0,
    currentWeek: 5,
    currentDay: 2,
    ...over,
  };
}

const ids = (r: ReturnType<typeof buildRecommendations>) => r.map((x) => x.id);

describe("buildRecommendations", () => {
  it("is sorted by descending priority", () => {
    const recs = buildRecommendations(input({ quests: [quest(false)], overdueCards: 30 }));
    const priorities = recs.map((r) => r.priority);
    expect([...priorities].sort((a, b) => b - a)).toEqual(priorities);
  });

  it("always leaves something actionable on screen", () => {
    expect(ids(buildRecommendations(input()))).toContain("default-mixed");
  });

  it("puts today's open quests above a weak domain", () => {
    const attempts = [attempt("a", 1, 5, 40), attempt("b", 1, 2, 45)];
    const recs = buildRecommendations(input({ attempts, quests: [quest(false)] }));
    expect(recs[0].id).toBe("todays-quests");
    expect(ids(recs)).toContain("weak-domain-1");
  });

  it("does not call a domain weak on a single attempt", () => {
    const recs = buildRecommendations(input({ attempts: [attempt("a", 1, 2, 30)] }));
    expect(ids(recs).some((id) => id.startsWith("weak-domain"))).toBe(false);
  });

  it("suggests clearing a large overdue backlog", () => {
    expect(ids(buildRecommendations(input({ overdueCards: 30 })))).toContain("overdue-cards");
  });

  // Regression: mixed and full attempts store domainId: null, so filtering the
  // untouched list on domainId alone told a user who had sat three full exams
  // that they had never tested a domain.
  it("does not claim a domain is untested after full-length exams", () => {
    const attempts = [
      attempt("f1", null, 6, 72, "full"),
      attempt("f2", null, 4, 75, "full"),
      attempt("f3", null, 2, 78, "full"),
    ];
    expect(ids(buildRecommendations(input({ attempts }))).some((id) => id.startsWith("untouched"))).toBe(
      false,
    );
  });

  it("still surfaces untested domains for a domain-only history", () => {
    const attempts = [
      attempt("a", 1, 6, 80),
      attempt("b", 1, 4, 80),
      attempt("c", 1, 2, 80),
    ];
    expect(ids(buildRecommendations(input({ attempts }))).some((id) => id.startsWith("untouched"))).toBe(
      true,
    );
  });

  it("handles a profile that has never studied", () => {
    const never: Profile = { ...profile, lastActiveDate: null, streak: 0, xp: 0 };
    const recs = buildRecommendations(input({ profile: never }));
    expect(recs.length).toBeGreaterThan(0);
    expect(ids(recs)).toContain("default-mixed");
  });
});
