import { describe, it, expect } from "vitest";
import { ALL_QUESTIONS } from "./questions.seed";
import { buildFlashcardSeed } from "./flashcards.seed";
import { ORDER_GAMES, VAULT_TABLES } from "./vault";
import { QUEST_SEEDS } from "./weeks";
import { DOMAINS } from "./domains";

/**
 * Guards over the seeded study material.
 *
 * These import the real modules rather than reading the source, and that is the
 * lesson from the audit that produced them: a regex pass over the .ts files
 * parsed the questions perfectly and silently found only 2 of the 12 vault
 * sequences, because their shape differs. A check that quietly under-reports is
 * worse than no check, because it reads as a pass.
 */

const domainIds = new Set(DOMAINS.map((d) => d.id));

describe("question bank — structure", () => {
  it("has questions to check", () => {
    expect(ALL_QUESTIONS.length).toBeGreaterThan(200);
  });

  it("gives every question a unique id", () => {
    const ids = ALL_QUESTIONS.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("offers exactly four distinct options everywhere", () => {
    for (const q of ALL_QUESTIONS) {
      expect(q.options, q.id).toHaveLength(4);
      expect(new Set(q.options).size, q.id).toBe(4);
      for (const o of q.options) expect(o.trim(), q.id).not.toBe("");
    }
  });

  it("keeps answerIndex inside the options", () => {
    for (const q of ALL_QUESTIONS) {
      expect(q.answerIndex, q.id).toBeGreaterThanOrEqual(0);
      expect(q.answerIndex, q.id).toBeLessThan(q.options.length);
    }
  });

  // A trap that IS the answer would flag a correct answer as a technician miss,
  // quietly corrupting the CISO-thinking score.
  it("never makes the technician trap the correct answer", () => {
    for (const q of ALL_QUESTIONS) {
      if (q.technicianTrap === undefined) continue;
      expect(q.technicianTrap, q.id).toBeLessThan(q.options.length);
      expect(q.technicianTrap, q.id).not.toBe(q.answerIndex);
    }
  });

  it("explains every answer and tags every question", () => {
    for (const q of ALL_QUESTIONS) {
      expect(q.explanation.trim().length, q.id).toBeGreaterThan(20);
      expect(q.tags.length, q.id).toBeGreaterThan(0);
      expect(q.prompt.trim().length, q.id).toBeGreaterThan(10);
      expect(domainIds.has(q.domainId), q.id).toBe(true);
    }
  });

  // Two prompts used to spell out "A) … B) … C) … D) …" and then repeat the
  // same text as the options, which reads as a formatting mistake and wastes
  // the stem.
  it("does not restate the options inside the prompt", () => {
    const offenders = ALL_QUESTIONS.filter(
      (q) => /\bA\)\s/.test(q.prompt) && /\bB\)\s/.test(q.prompt),
    ).map((q) => q.id);
    expect(offenders).toEqual([]);
  });
});

/**
 * The anti-gaming guards.
 *
 * The audit that prompted this found the bank beatable with no CISSP knowledge
 * at all: the correct answer sat at option B in 196 of 246 questions (always-B
 * scored 79.7%, past the pass mark) and was the longest option in 234 of 246
 * (always-longest scored 95%).
 *
 * Position is now handled at render time by `optionOrder`, so the stored index
 * no longer leaks. Length is a property of the content itself and no amount of
 * shuffling fixes it — these thresholds are what stop it coming back.
 */
describe("question bank — not gameable", () => {
  const share = (n: number) => n / ALL_QUESTIONS.length;

  /**
   * RATCHETS, not final thresholds.
   *
   * The distractor rewrite is landing one source file at a time, so these two
   * assert "no worse than today" rather than the eventual target. **Lower them
   * with each batch.** They exist now so the number cannot drift back up while
   * the work is in progress.
   *
   *   longest-is-correct   today 95%  ->  target below 45% (chance is 25%)
   *   conspicuously longer today 195  ->  target 0
   */
  const LONGEST_IS_CORRECT_CEILING = 0.96;
  const CONSPICUOUS_CEILING = 195;

  it("does not make the correct answer the longest option", () => {
    const longest = ALL_QUESTIONS.filter((q) => {
      const lengths = q.options.map((o) => o.length);
      return lengths[q.answerIndex] === Math.max(...lengths);
    }).length;
    expect(share(longest)).toBeLessThanOrEqual(LONGEST_IS_CORRECT_CEILING);
  });

  it("does not make the correct answer conspicuously longer than its distractors", () => {
    const inflated = ALL_QUESTIONS.filter((q) => {
      const correct = q.options[q.answerIndex].length;
      const others = q.options.filter((_, i) => i !== q.answerIndex).map((o) => o.length);
      return correct > 1.6 * (others.reduce((s, l) => s + l, 0) / others.length);
    }).map((q) => q.id);
    expect(inflated.length).toBeLessThanOrEqual(CONSPICUOUS_CEILING);
  });

  it("does not let the shortest option be a reliable elimination", () => {
    const shortestIsCorrect = ALL_QUESTIONS.filter((q) => {
      const lengths = q.options.map((o) => o.length);
      return lengths[q.answerIndex] === Math.min(...lengths);
    }).length;
    expect(share(shortestIsCorrect)).toBeLessThan(0.45);
  });
});

describe("question bank — coverage", () => {
  it("weights the eight domains to exactly 100%", () => {
    expect(DOMAINS.reduce((s, d) => s + d.weight, 0)).toBe(100);
  });

  it("covers every domain", () => {
    for (const d of DOMAINS) {
      const n = ALL_QUESTIONS.filter((q) => q.domainId === d.id).length;
      expect(n, `domain ${d.id}`).toBeGreaterThan(15);
    }
  });

  // A full exam draws at random from the bank, so if the bank is skewed the
  // simulation is skewed with it.
  it("keeps each domain's share of the bank near its share of the exam", () => {
    for (const d of DOMAINS) {
      const pct = (ALL_QUESTIONS.filter((q) => q.domainId === d.id).length / ALL_QUESTIONS.length) * 100;
      expect(Math.abs(pct - d.weight), `domain ${d.id}: ${pct.toFixed(1)}% vs ${d.weight}%`).toBeLessThan(6);
    }
  });
});

describe("flashcards", () => {
  const cards = buildFlashcardSeed();

  it("has a deck to check", () => {
    expect(cards.length).toBeGreaterThan(150);
  });

  it("gives every card a unique id and a unique front", () => {
    expect(new Set(cards.map((c) => c.id)).size).toBe(cards.length);
    expect(new Set(cards.map((c) => c.front.trim().toLowerCase())).size).toBe(cards.length);
  });

  it("never leaves a side blank", () => {
    for (const c of cards) {
      expect(c.front.trim(), c.id).not.toBe("");
      expect(c.back.trim(), c.id).not.toBe("");
    }
  });

  /**
   * `domainId: null` is deliberate, not a gap. Ten cards are cross-domain exam
   * strategy — "FIRST vs BEST", "CAT format", "Safety always wins" — and
   * FlashcardsPage renders them under a "Mindset" tab that counts exactly the
   * null-domain cards. What matters is that the value is null and not junk.
   */
  it("files every card under a real domain, or explicitly under none", () => {
    const bad = cards
      .filter((c) => c.domainId !== null && !domainIds.has(c.domainId))
      .map((c) => `${c.id} (domainId=${JSON.stringify(c.domainId)}) "${c.front.slice(0, 40)}"`);
    expect(bad).toEqual([]);
  });

  it("keeps the cross-domain mindset cards", () => {
    expect(cards.filter((c) => c.domainId === null).length).toBeGreaterThan(5);
  });

  it("covers all eight domains", () => {
    for (const d of DOMAINS) {
      expect(cards.filter((c) => c.domainId === d.id).length, `domain ${d.id}`).toBeGreaterThan(5);
    }
  });
});

describe("vault", () => {
  it("has both sequences and tables", () => {
    expect(ORDER_GAMES.length).toBeGreaterThanOrEqual(12);
    expect(VAULT_TABLES.length).toBeGreaterThanOrEqual(12);
  });

  it("gives every sequence and table a unique id", () => {
    expect(new Set(ORDER_GAMES.map((g) => g.id)).size).toBe(ORDER_GAMES.length);
    expect(new Set(VAULT_TABLES.map((t) => t.id)).size).toBe(VAULT_TABLES.length);
  });

  // A repeated step makes the drag-to-order game unwinnable: two identical
  // entries can be swapped and the check compares by value.
  it("orders at least three distinct steps per sequence", () => {
    for (const g of ORDER_GAMES) {
      expect(g.order.length, g.id).toBeGreaterThanOrEqual(3);
      expect(new Set(g.order).size, g.id).toBe(g.order.length);
      for (const step of g.order) expect(step.trim(), g.id).not.toBe("");
    }
  });

  it("explains why every sequence matters", () => {
    for (const g of ORDER_GAMES) expect(g.why.trim().length, g.id).toBeGreaterThan(20);
  });

  it("gives every table row the same width as its header", () => {
    for (const t of VAULT_TABLES) {
      expect(t.rows.length, t.id).toBeGreaterThan(0);
      for (const row of t.rows) {
        expect(row.length, `${t.id}: ${row[0]}`).toBe(t.columns.length);
        for (const cell of row) expect(cell.trim(), t.id).not.toBe("");
      }
    }
  });
});

describe("quests", () => {
  it("gives every quest a unique id", () => {
    expect(new Set(QUEST_SEEDS.map((q) => q.id)).size).toBe(QUEST_SEEDS.length);
  });

  it("places every quest inside the eight-week campaign", () => {
    for (const q of QUEST_SEEDS) {
      expect(q.week, q.id).toBeGreaterThanOrEqual(1);
      expect(q.week, q.id).toBeLessThanOrEqual(8);
      expect(q.day, q.id).toBeGreaterThanOrEqual(1);
      expect(q.day, q.id).toBeLessThanOrEqual(7);
    }
  });
});
