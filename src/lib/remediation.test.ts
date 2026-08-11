import { describe, it, expect } from "vitest";
import type { DomainId, QuizAnswer } from "../db/schema";
import { breakdownMisses, buildRemediation, MIN_MISSES } from "./remediation";

let seq = 0;
function miss(over: Partial<QuizAnswer> = {}): QuizAnswer {
  return {
    id: `a-${seq++}`,
    attemptId: "att-1",
    questionId: `q-${seq}`,
    pickedIndex: 0,
    correct: false,
    timeTakenMs: 30_000,
    flaggedMindset: false,
    flaggedSpeed: false,
    missCategory: null,
    confidence: null,
    ...over,
  };
}

const many = (n: number, over: Partial<QuizAnswer> = {}) =>
  Array.from({ length: n }, () => miss(over));

/** Every question belongs to domain 1 unless the id says otherwise. */
const domainOf = (id: string): DomainId | undefined => {
  const m = /^d(\d)-/.exec(id);
  return m ? (Number(m[1]) as DomainId) : 1;
};

describe("breakdownMisses", () => {
  it("ignores correct answers entirely", () => {
    const b = breakdownMisses([...many(3), miss({ correct: true })], domainOf);
    expect(b.total).toBe(3);
  });

  it("lets the manual category win over the automatic flags", () => {
    const b = breakdownMisses(
      [miss({ missCategory: "knowledge", flaggedMindset: true, flaggedSpeed: true })],
      domainOf,
    );
    expect(b.knowledge).toBe(1);
    expect(b.mindset).toBe(0);
    expect(b.misread).toBe(0);
  });

  // Most misses are never manually categorised, so the automatic flags carry
  // the feature for the people who need it most.
  it("falls back to the automatic flags", () => {
    const b = breakdownMisses(
      [miss({ flaggedMindset: true }), miss({ flaggedSpeed: true })],
      domainOf,
    );
    expect(b.mindset).toBe(1);
    expect(b.misread).toBe(1);
  });

  it("prefers mindset over speed when both fired", () => {
    const b = breakdownMisses([miss({ flaggedMindset: true, flaggedSpeed: true })], domainOf);
    expect(b.mindset).toBe(1);
    expect(b.misread).toBe(0);
  });

  it("treats an unflagged, uncategorised miss as a knowledge gap", () => {
    expect(breakdownMisses([miss()], domainOf).knowledge).toBe(1);
  });

  it("classifies every miss exactly once", () => {
    const answers = [
      ...many(3, { flaggedMindset: true }),
      ...many(2, { flaggedSpeed: true }),
      ...many(4),
      ...many(2, { missCategory: "misread" }),
    ];
    const b = breakdownMisses(answers, domainOf);
    expect(b.mindset + b.knowledge + b.misread).toBe(b.total);
    expect(b.total).toBe(11);
  });

  it("attributes knowledge misses to their domain", () => {
    const b = breakdownMisses(
      [miss({ questionId: "d3-a" }), miss({ questionId: "d3-b" }), miss({ questionId: "d7-a" })],
      domainOf,
    );
    expect(b.byDomain.get(3)).toBe(2);
    expect(b.byDomain.get(7)).toBe(1);
  });

  it("does not attribute mindset or misread misses to a domain", () => {
    const b = breakdownMisses(
      [miss({ questionId: "d3-a", flaggedMindset: true }), miss({ questionId: "d3-b", flaggedSpeed: true })],
      domainOf,
    );
    expect(b.byDomain.size).toBe(0);
  });

  it("skips a miss whose question is no longer in the bank", () => {
    const b = breakdownMisses([miss({ questionId: "gone" })], () => undefined);
    expect(b.knowledge).toBe(1);
    expect(b.byDomain.size).toBe(0);
  });
});

describe("buildRemediation", () => {
  // A handful of misses is a couple of bad questions, not a pattern.
  it("says nothing below the minimum", () => {
    const b = breakdownMisses(many(MIN_MISSES - 1, { flaggedMindset: true }), domainOf);
    expect(buildRemediation(b)).toEqual([]);
  });

  it("calls out a dominant mindset pattern", () => {
    const b = breakdownMisses(many(10, { flaggedMindset: true }), domainOf);
    const recs = buildRemediation(b);
    expect(recs.map((r) => r.id)).toContain("remediate-mindset");
    const rec = recs.find((r) => r.id === "remediate-mindset")!;
    expect(rec.to).toBe("/vault");
    expect(rec.title).toMatch(/10 of your 10/);
  });

  it("calls out a dominant misread pattern and points at pacing", () => {
    const b = breakdownMisses(many(10, { flaggedSpeed: true }), domainOf);
    const rec = buildRemediation(b).find((r) => r.id === "remediate-misread")!;
    expect(rec.to).toBe("/stats");
  });

  it("stays quiet when misses are spread evenly across categories", () => {
    const b = breakdownMisses(
      [
        ...many(4, { flaggedMindset: true }),
        ...many(4, { flaggedSpeed: true }),
        ...many(4),
      ],
      // Spread the knowledge misses so no single domain concentrates either.
      (id) => (Number(id.slice(2)) % 8 + 1) as DomainId,
    );
    expect(buildRemediation(b)).toEqual([]);
  });

  it("names a domain where knowledge misses cluster", () => {
    const b = breakdownMisses(
      [...many(8).map((a) => ({ ...a, questionId: "d5-x" })), ...many(2)],
      domainOf,
    );
    const rec = buildRemediation(b).find((r) => r.id === "remediate-knowledge-5")!;
    expect(rec).toBeDefined();
    expect(rec.to).toBe("/domains/5");
    expect(rec.title).toMatch(/D5/);
  });

  // Knowledge misses spread across every domain just mean "keep studying",
  // which is not advice.
  it("does not name a domain when knowledge misses are diffuse", () => {
    const answers = Array.from({ length: 16 }, (_, i) => miss({ questionId: `d${(i % 8) + 1}-x` }));
    const b = breakdownMisses(answers, domainOf);
    expect(buildRemediation(b).some((r) => r.id.startsWith("remediate-knowledge"))).toBe(false);
  });

  it("ranks mindset above the generic weak-domain drill at 92", () => {
    const b = breakdownMisses(many(10, { flaggedMindset: true }), domainOf);
    expect(buildRemediation(b).find((r) => r.id === "remediate-mindset")!.priority).toBeGreaterThan(92);
  });

  it("can return more than one action", () => {
    const b = breakdownMisses(
      [...many(6, { flaggedMindset: true }), ...many(6, { flaggedSpeed: true })],
      domainOf,
    );
    const ids = buildRemediation(b).map((r) => r.id);
    expect(ids).toContain("remediate-mindset");
    expect(ids).toContain("remediate-misread");
  });

  it("gives every action the fields the dashboard renders", () => {
    const b = breakdownMisses(many(10, { flaggedMindset: true }), domainOf);
    for (const r of buildRemediation(b)) {
      expect(r).toMatchObject({
        id: expect.any(String),
        icon: expect.any(String),
        title: expect.any(String),
        body: expect.any(String),
        to: expect.any(String),
        actionLabel: expect.any(String),
        priority: expect.any(Number),
      });
    }
  });
});
