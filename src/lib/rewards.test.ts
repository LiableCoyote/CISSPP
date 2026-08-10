import { describe, it, expect } from "vitest";
import { quizXp, flashcardXp, quickTestXp, QUIZ_MODE_BONUS } from "./rewards";

describe("quizXp", () => {
  it("pays two per percentage point plus the mode bonus", () => {
    expect(quizXp(50, "domain")).toBe(100 + QUIZ_MODE_BONUS.domain);
    expect(quizXp(100, "full")).toBe(200 + QUIZ_MODE_BONUS.full);
  });

  // Finishing the 150-question exam is the behaviour being reinforced; the
  // wrong answers already cost the score.
  it("still pays the bonus on a zero score", () => {
    expect(quizXp(0, "full")).toBe(QUIZ_MODE_BONUS.full);
    expect(quizXp(0, "domain")).toBe(QUIZ_MODE_BONUS.domain);
  });

  it("ranks the modes: full beats mixed beats domain at equal accuracy", () => {
    expect(quizXp(80, "full")).toBeGreaterThan(quizXp(80, "mixed"));
    expect(quizXp(80, "mixed")).toBeGreaterThan(quizXp(80, "domain"));
  });

  it("returns whole numbers", () => {
    for (const pct of [33, 67, 1, 99]) {
      expect(Number.isInteger(quizXp(pct, "mixed"))).toBe(true);
    }
  });
});

describe("flashcardXp", () => {
  it("pays more for a recall than a lapse", () => {
    expect(flashcardXp(3)).toBeGreaterThan(flashcardXp(1));
  });

  it("splits at the SM-2 pass mark of 3", () => {
    expect(flashcardXp(0)).toBe(2);
    expect(flashcardXp(1)).toBe(2);
    expect(flashcardXp(3)).toBe(5);
    expect(flashcardXp(4)).toBe(5);
  });

  // Paying nothing for a lapse would reward grading yourself generously, which
  // corrupts the scheduling the whole deck depends on.
  it("never pays zero, so honest failure is not punished", () => {
    expect(flashcardXp(0)).toBeGreaterThan(0);
  });
});

describe("quickTestXp", () => {
  it("pays a flat entry plus up to ten for accuracy", () => {
    expect(quickTestXp(0)).toBe(10);
    expect(quickTestXp(100)).toBe(20);
    expect(quickTestXp(50)).toBe(15);
  });

  it("is monotonic in the score", () => {
    let prev = -1;
    for (let pct = 0; pct <= 100; pct += 5) {
      const xp = quickTestXp(pct);
      expect(xp).toBeGreaterThanOrEqual(prev);
      prev = xp;
    }
  });

  // A vault drill is a warm-up, not a study session — it must not out-earn a
  // full exam or the incentives invert.
  it("is worth less than any quiz", () => {
    expect(quickTestXp(100)).toBeLessThan(quizXp(0, "domain"));
  });
});
