import { describe, it, expect } from "vitest";
import { ORDER_GAMES } from "../../data/vault";
import { buildQuickTest } from "./quickTest";

const RUNS = 30; // the generator shuffles, so sample rather than trusting one pass

describe("ORDER_GAMES data", () => {
  // OrderGame.tsx uses the item string as a React key and buildOptions filters
  // by string equality — a repeated step would break both.
  it.each(ORDER_GAMES.map((g) => [g.id, g] as const))("%s has no repeated steps", (_id, game) => {
    expect(new Set(game.order).size).toBe(game.order.length);
  });

  it.each(ORDER_GAMES.map((g) => [g.id, g] as const))("%s has at least 4 steps", (_id, game) => {
    expect(game.order.length).toBeGreaterThanOrEqual(4);
  });
});

describe("buildQuickTest", () => {
  it.each(ORDER_GAMES.map((g) => [g.id, g] as const))(
    "%s produces a valid question set",
    (_id, game) => {
      // A set can hold at most one question per step.
      const expected = Math.min(5, game.order.length);
      for (let run = 0; run < RUNS; run++) {
        const qs = buildQuickTest(game, 5);

        expect(qs).toHaveLength(expected);

        // No repeated question ids.
        expect(new Set(qs.map((q) => q.id)).size).toBe(expected);

        for (const q of qs) {
          // The indicated answer must actually be a step of this sequence.
          expect(game.order).toContain(q.options[q.answerIndex]);
          // Options must be distinct.
          expect(new Set(q.options).size).toBe(q.options.length);
          expect(q.prompt.length).toBeGreaterThan(0);
          expect(q.explain.length).toBeGreaterThan(0);
        }

        // Regression: `-first` and `-pos-0` were the same question in different
        // words (same answer, same pool), as were `-last` and `-pos-{n-1}`.
        // Two questions in one set must never share a correct answer.
        const answers = qs.map((q) => q.options[q.answerIndex]);
        expect(new Set(answers).size).toBe(answers.length);

        // Every question in a set should offer the same number of choices.
        const counts = new Set(qs.map((q) => q.options.length));
        expect(counts.size).toBe(1);
      }
    },
  );

  it("returns nothing for a degenerate sequence", () => {
    expect(buildQuickTest({ ...ORDER_GAMES[0], order: ["only"] }, 5)).toEqual([]);
  });
});
