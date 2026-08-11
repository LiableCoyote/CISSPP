import { describe, it, expect } from "vitest";
import { subDays, addDays, formatISO } from "date-fns";
import type { DomainId, QuizAttempt } from "../db/schema";
import { DOMAINS } from "../data/domains";
import {
  weightedMastery,
  coverageByDomain,
  readiness,
  projectReadiness,
  MIN_DOMAIN_COVERAGE,
  MIN_TREND_POINTS,
  PASS_MARK,
} from "./readiness";

const NOW = new Date("2026-06-01T12:00:00.000Z");

let seq = 0;
function attempt(domainId: DomainId | null, scorePct: number, daysAgo = 1): QuizAttempt {
  const started = subDays(NOW, daysAgo).toISOString();
  return {
    id: `att-${seq++}`,
    mode: domainId ? "domain" : "mixed",
    domainId,
    questionIds: [],
    startedAt: started,
    finishedAt: started,
    totalSeconds: 600,
    score: 0,
    scorePct,
    passed: null,
    targetScorePct: null,
  };
}

/** A scored attempt in every domain, all at the same percentage. */
const allDomainsAt = (pct: number) => DOMAINS.map((d) => attempt(d.id, pct));

const fullCoverage = () => {
  const m = new Map<number, number>();
  for (const d of DOMAINS) m.set(d.id, 100);
  return m;
};

describe("weightedMastery", () => {
  it("is the flat score when every domain is equal", () => {
    expect(weightedMastery(allDomainsAt(80))).toBe(80);
  });

  it("is zero with no attempts", () => {
    expect(weightedMastery([])).toBe(0);
  });

  // The reason this exists: a flat average flatters someone strong in the
  // light domains.
  it("weights heavy domains more than light ones", () => {
    const heaviest = [...DOMAINS].sort((a, b) => b.weight - a.weight)[0];
    const lightest = [...DOMAINS].sort((a, b) => a.weight - b.weight)[0];
    expect(heaviest.weight).toBeGreaterThan(lightest.weight);

    const strongOnHeavy = weightedMastery([attempt(heaviest.id, 100)]);
    const strongOnLight = weightedMastery([attempt(lightest.id, 100)]);
    expect(strongOnHeavy).toBeGreaterThan(strongOnLight);
  });

  // Dropping untested domains from the denominator would let someone reach
  // "on-track" having studied two of eight.
  it("counts an untested domain as zero rather than excluding it", () => {
    const onlyOne = weightedMastery([attempt(1, 100)]);
    expect(onlyOne).toBeLessThan(100);
    expect(onlyOne).toBeGreaterThan(0);
  });

  it("ignores abandoned attempts", () => {
    const abandoned = { ...attempt(1, 100), finishedAt: null };
    expect(weightedMastery([abandoned])).toBe(0);
  });
});

describe("coverageByDomain", () => {
  const answers = (ids: string[]) =>
    ids.map((questionId, i) => ({
      id: `a-${i}`,
      attemptId: "att",
      questionId,
      pickedIndex: 0,
      correct: true,
      timeTakenMs: 1000,
      flaggedMindset: false,
      flaggedSpeed: false,
      missCategory: null,
      confidence: null,
    }));

  it("counts answers per domain and starts every domain at zero", () => {
    const cov = coverageByDomain(answers(["q1", "q2", "q3"]), (id) => (id === "q3" ? 2 : 1));
    expect(cov.get(1)).toBe(2);
    expect(cov.get(2)).toBe(1);
    expect(cov.get(8)).toBe(0);
  });

  it("skips questions no longer in the bank", () => {
    const cov = coverageByDomain(answers(["gone"]), () => undefined);
    expect([...cov.values()].every((v) => v === 0)).toBe(true);
  });
});

describe("readiness", () => {
  it("bands against the 70% pass mark", () => {
    expect(readiness(allDomainsAt(PASS_MARK), fullCoverage()).band).toBe("on-track");
    expect(readiness(allDomainsAt(65), fullCoverage()).band).toBe("borderline");
    expect(readiness(allDomainsAt(45), fullCoverage()).band).toBe("not-ready");
  });

  it("reports high confidence only with full, deep coverage", () => {
    const r = readiness(allDomainsAt(80), fullCoverage());
    expect(r.confidence).toBe("high");
    expect(r.untestedDomains).toEqual([]);
    expect(r.thinDomains).toEqual([]);
  });

  // The headline honesty requirement.
  it("names untested domains and drops confidence", () => {
    const r = readiness([attempt(1, 90), attempt(2, 90), attempt(3, 90)], fullCoverage());
    expect(r.confidence).toBe("low");
    expect(r.untestedDomains).toEqual([4, 5, 6, 7, 8]);
    expect(r.caveats.join(" ")).toMatch(/D4/);
    expect(r.caveats.join(" ")).toMatch(/count as zero/i);
  });

  it("names thin domains without calling them untested", () => {
    const thin = fullCoverage();
    thin.set(3, MIN_DOMAIN_COVERAGE - 1);
    const r = readiness(allDomainsAt(80), thin);
    expect(r.thinDomains).toEqual([3]);
    expect(r.untestedDomains).toEqual([]);
    expect(r.caveats.join(" ")).toMatch(/Thin coverage in D3/);
    // Singular: "under 20 answers each" reads wrong for one domain.
    expect(r.caveats.join(" ")).toMatch(/that average moves a lot/);
  });

  it("pluralises the thin-coverage caveat for several domains", () => {
    const thin = new Map(fullCoverage());
    thin.set(3, 1);
    thin.set(6, 1);
    expect(readiness(allDomainsAt(80), thin).caveats.join(" ")).toMatch(
      /D3, D6 — under \d+ answers each, so those averages move a lot/,
    );
  });

  it("does not double-report an untested domain as thin", () => {
    const r = readiness([attempt(1, 80)], new Map());
    expect(r.thinDomains).not.toContain(2);
    expect(r.untestedDomains).toContain(2);
  });

  it("treats a domain exactly at the coverage floor as adequate", () => {
    const cov = fullCoverage();
    cov.set(5, MIN_DOMAIN_COVERAGE);
    expect(readiness(allDomainsAt(80), cov).thinDomains).toEqual([]);
  });

  it("always carries at least the practice-questions caveat", () => {
    const r = readiness(allDomainsAt(80), fullCoverage());
    expect(r.caveats.length).toBeGreaterThan(0);
    expect(r.caveats.join(" ")).toMatch(/not the real exam/i);
  });

  it("says so plainly when nothing has been completed", () => {
    const r = readiness([], new Map());
    expect(r.scorePct).toBe(0);
    expect(r.confidence).toBe("low");
    expect(r.caveats.join(" ")).toMatch(/no completed quizzes/i);
  });

  it("keeps confidence low on very few attempts even with full coverage", () => {
    const r = readiness([attempt(1, 80)], fullCoverage());
    expect(r.confidence).toBe("low");
  });
});

describe("projectReadiness", () => {
  const iso = (d: Date) => formatISO(d, { representation: "date" });

  /** Attempts on `n` distinct days, improving by `step` a day. */
  const rising = (n: number, start = 50, step = 2) =>
    Array.from({ length: n }, (_, i) => attempt(1, start + i * step, n - i));

  it("returns null with no exam date", () => {
    expect(projectReadiness(rising(5), null, NOW)).toBeNull();
  });

  it("returns null once the exam has passed", () => {
    expect(projectReadiness(rising(5), iso(subDays(NOW, 1)), NOW)).toBeNull();
  });

  // Two points is a line through noise.
  it("refuses to project below the minimum number of days", () => {
    expect(projectReadiness(rising(MIN_TREND_POINTS - 1), iso(addDays(NOW, 30)), NOW)).toBeNull();
  });

  it("projects once there are enough distinct days", () => {
    const p = projectReadiness(rising(MIN_TREND_POINTS), iso(addDays(NOW, 30)), NOW);
    expect(p).not.toBeNull();
    expect(p!.daysRemaining).toBe(30);
  });

  it("refuses when every attempt lands on one day", () => {
    const sameDay = [attempt(1, 50, 2), attempt(1, 60, 2), attempt(1, 70, 2)];
    expect(projectReadiness(sameDay, iso(addDays(NOW, 30)), NOW)).toBeNull();
  });

  it("follows an improving trend upward", () => {
    const p = projectReadiness(rising(6, 50, 3), iso(addDays(NOW, 10)), NOW)!;
    expect(p.perDay).toBeGreaterThan(0);
    expect(p.projectedPct).toBeGreaterThan(60);
  });

  it("follows a declining trend downward", () => {
    const p = projectReadiness(rising(6, 80, -3), iso(addDays(NOW, 10)), NOW)!;
    expect(p.perDay).toBeLessThan(0);
  });

  it("clamps a runaway extrapolation to 0-100", () => {
    const steep = projectReadiness(rising(6, 60, 8), iso(addDays(NOW, 200)), NOW)!;
    expect(steep.projectedPct).toBe(100);
    const crash = projectReadiness(rising(6, 60, -8), iso(addDays(NOW, 200)), NOW)!;
    expect(crash.projectedPct).toBe(0);
  });

  // A binge day must count as one data point, not twenty, or an afternoon of
  // quizzes would dominate a fortnight of steady work.
  it("collapses a day of many attempts to a single point", () => {
    // rising(5) occupies days 5..1, so day 0 is free for the binge.
    const base = rising(5, 50, 2);
    const twenty = Array.from({ length: 20 }, () => attempt(1, 5, 0));
    const withSpam = projectReadiness([...base, ...twenty], iso(addDays(NOW, 10)), NOW)!;
    const once = projectReadiness([...base, attempt(1, 5, 0)], iso(addDays(NOW, 10)), NOW)!;
    expect(withSpam.perDay).toBeCloseTo(once.perDay, 5);
    expect(withSpam.projectedPct).toBe(once.projectedPct);
  });

  it("averages differing scores within the same day", () => {
    const base = rising(4, 50, 2);
    const split = projectReadiness([...base, attempt(1, 0, 0), attempt(1, 100, 0)], iso(addDays(NOW, 10)), NOW)!;
    const midpoint = projectReadiness([...base, attempt(1, 50, 0)], iso(addDays(NOW, 10)), NOW)!;
    expect(split.perDay).toBeCloseTo(midpoint.perDay, 5);
  });

  it("ignores attempts older than the trend window", () => {
    const ancient = attempt(1, 5, 200);
    const withAncient = projectReadiness([...rising(4), ancient], iso(addDays(NOW, 10)), NOW)!;
    const without = projectReadiness(rising(4), iso(addDays(NOW, 10)), NOW)!;
    expect(withAncient.perDay).toBeCloseTo(without.perDay, 5);
  });

  it("ignores abandoned attempts", () => {
    const abandoned = { ...attempt(1, 5, 1), finishedAt: null };
    const p = projectReadiness([...rising(4), abandoned], iso(addDays(NOW, 10)), NOW)!;
    const clean = projectReadiness(rising(4), iso(addDays(NOW, 10)), NOW)!;
    expect(p.perDay).toBeCloseTo(clean.perDay, 5);
  });
});
