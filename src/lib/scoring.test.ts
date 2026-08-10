import { describe, it, expect } from "vitest";
import type { Question } from "../db/schema";
import {
  pickQuestions,
  shuffle,
  scoreQuiz,
  didPass,
  targetScorePct,
  cisoCounterPatch,
  MODE_LIMITS,
  MODE_SECONDS,
} from "./scoring";

function q(id: number, domainId: number): Question {
  return {
    id: `q-${id}`,
    domainId: domainId as Question["domainId"],
    prompt: `prompt ${id}`,
    options: ["a", "b", "c", "d"],
    answerIndex: 0,
    explanation: "because",
    tags: [],
    isMindsetHeavy: false,
  };
}

/** Deterministic stand-in for Math.random: cycles a fixed list. */
function seededRng(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

const POOL = Array.from({ length: 200 }, (_, i) => q(i, (i % 8) + 1));

describe("shuffle", () => {
  it("is a permutation, not a mutation", () => {
    const input = [1, 2, 3, 4, 5];
    const out = shuffle(input, seededRng([0.1, 0.9, 0.4, 0.7]));
    expect(input).toEqual([1, 2, 3, 4, 5]);
    expect([...out].sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it("is deterministic given a deterministic rng", () => {
    const a = shuffle(POOL, seededRng([0.3, 0.6, 0.1]));
    const b = shuffle(POOL, seededRng([0.3, 0.6, 0.1]));
    expect(a.map((x) => x.id)).toEqual(b.map((x) => x.id));
  });
});

describe("pickQuestions", () => {
  it("serves the mode's limit when the pool is large enough", () => {
    expect(pickQuestions(POOL, "full", null, seededRng([0.5])).length).toBe(MODE_LIMITS.full);
    expect(pickQuestions(POOL, "mixed", null, seededRng([0.5])).length).toBe(MODE_LIMITS.mixed);
    expect(pickQuestions(POOL, "domain", 1, seededRng([0.5])).length).toBe(MODE_LIMITS.domain);
  });

  it("never serves more than the pool holds", () => {
    const tiny = POOL.slice(0, 3);
    expect(pickQuestions(tiny, "full", null, seededRng([0.5])).length).toBe(3);
  });

  it("returns empty rather than throwing on an empty pool", () => {
    expect(pickQuestions([], "mixed", null, seededRng([0.5]))).toEqual([]);
  });

  it("filters to the requested domain in domain mode", () => {
    const picked = pickQuestions(POOL, "domain", 3, seededRng([0.5]));
    expect(picked.length).toBeGreaterThan(0);
    expect(picked.every((x) => x.domainId === 3)).toBe(true);
  });

  // A stale ?domain= in the URL must not quietly turn a 150-question exam into
  // a single-domain one.
  it("ignores domainId in mixed and full modes", () => {
    for (const mode of ["mixed", "full"] as const) {
      const picked = pickQuestions(POOL, mode, 3, seededRng([0.5]));
      expect(new Set(picked.map((x) => x.domainId)).size).toBeGreaterThan(1);
    }
  });

  it("returns no duplicates", () => {
    const picked = pickQuestions(POOL, "full", null, seededRng([0.17, 0.83, 0.42, 0.05]));
    expect(new Set(picked.map((x) => x.id)).size).toBe(picked.length);
  });

  it("gives a domain with fewer questions than the limit all of them, once", () => {
    const scarce = [q(900, 5), q(901, 5), ...POOL.filter((x) => x.domainId !== 5)];
    const picked = pickQuestions(scarce, "domain", 5, seededRng([0.5]));
    expect(picked.map((x) => x.id).sort()).toEqual(["q-900", "q-901"]);
  });
});

describe("scoreQuiz", () => {
  it("counts correct answers and rounds the percentage", () => {
    const answers = [{ correct: true }, { correct: false }, { correct: true }];
    expect(scoreQuiz(answers, 3)).toEqual({ score: 2, scorePct: 67 });
  });

  it("is 100 for a clean sweep and 0 for a blank", () => {
    expect(scoreQuiz([{ correct: true }, { correct: true }], 2).scorePct).toBe(100);
    expect(scoreQuiz([{ correct: false }], 1).scorePct).toBe(0);
  });

  // The documented behaviour of a timed-out exam: unreached questions count
  // against you, because the clock running out is a result.
  it("divides by questions served, not answers given", () => {
    const answers = [{ correct: true }, { correct: true }];
    expect(scoreQuiz(answers, 10)).toEqual({ score: 2, scorePct: 20 });
  });

  it("does not divide by zero on an empty quiz", () => {
    expect(scoreQuiz([], 0)).toEqual({ score: 0, scorePct: 0 });
  });
});

describe("didPass and targetScorePct", () => {
  it("only the full exam has a pass mark", () => {
    expect(targetScorePct("full")).toBe(70);
    expect(targetScorePct("mixed")).toBeNull();
    expect(targetScorePct("domain")).toBeNull();
    expect(didPass(100, "mixed")).toBeNull();
  });

  it("passes at exactly the target, not just above it", () => {
    expect(didPass(70, "full")).toBe(true);
    expect(didPass(69, "full")).toBe(false);
  });
});

describe("cisoCounterPatch", () => {
  const zero = { mindsetChoicesCorrect: 0, technicianMisses: 0, speedReaderMisses: 0 };

  it("returns an empty patch when nothing fired", () => {
    expect(
      cisoCounterPatch(zero, {
        isMindsetHeavy: false,
        correct: true,
        technician: false,
        speedy: false,
      }),
    ).toEqual({});
  });

  it("credits a mindset-heavy question only when it was answered correctly", () => {
    const opts = { isMindsetHeavy: true, technician: false, speedy: false };
    expect(cisoCounterPatch(zero, { ...opts, correct: true })).toEqual({ mindsetChoicesCorrect: 1 });
    expect(cisoCounterPatch(zero, { ...opts, correct: false })).toEqual({});
  });

  // The asymmetry between the two miss counters, asserted so it survives the
  // next person who notices it and assumes it is a bug.
  it("counts a technician pick even when it happened to be correct", () => {
    expect(
      cisoCounterPatch(zero, {
        isMindsetHeavy: false,
        correct: true,
        technician: true,
        speedy: false,
      }),
    ).toEqual({ technicianMisses: 1 });
  });

  it("counts a speedy answer only when it was also wrong", () => {
    const opts = { isMindsetHeavy: false, technician: false, speedy: true };
    expect(cisoCounterPatch(zero, { ...opts, correct: false })).toEqual({ speedReaderMisses: 1 });
    expect(cisoCounterPatch(zero, { ...opts, correct: true })).toEqual({});
  });

  it("increments from the current values rather than assuming zero", () => {
    const current = { mindsetChoicesCorrect: 7, technicianMisses: 3, speedReaderMisses: 2 };
    expect(
      cisoCounterPatch(current, {
        isMindsetHeavy: true,
        correct: false,
        technician: true,
        speedy: true,
      }),
    ).toEqual({ technicianMisses: 4, speedReaderMisses: 3 });
  });
});

describe("mode tables", () => {
  it("gives the full exam the longest clock and the biggest set", () => {
    expect(MODE_SECONDS.full).toBeGreaterThan(MODE_SECONDS.mixed);
    expect(MODE_SECONDS.mixed).toBeGreaterThan(MODE_SECONDS.domain);
    expect(MODE_LIMITS.full).toBeGreaterThan(MODE_LIMITS.mixed);
    expect(MODE_LIMITS.mixed).toBeGreaterThan(MODE_LIMITS.domain);
  });

  it("matches the real exam shape: 150 questions in 3 hours", () => {
    expect(MODE_LIMITS.full).toBe(150);
    expect(MODE_SECONDS.full).toBe(10_800);
  });
});
