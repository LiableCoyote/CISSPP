import { describe, it, expect } from "vitest";
import { xpToLevel, levelToXp, LEVEL_TITLES, LEVEL_XP_THRESHOLDS } from "./xp";

describe("level tables", () => {
  // xpToLevel indexes LEVEL_TITLES by level, so the two must stay in step.
  it("has a title for every threshold", () => {
    expect(LEVEL_TITLES).toHaveLength(LEVEL_XP_THRESHOLDS.length);
  });

  it("has strictly increasing thresholds starting at 0", () => {
    expect(LEVEL_XP_THRESHOLDS[0]).toBe(0);
    for (let i = 1; i < LEVEL_XP_THRESHOLDS.length; i++) {
      expect(LEVEL_XP_THRESHOLDS[i]).toBeGreaterThan(LEVEL_XP_THRESHOLDS[i - 1]);
    }
  });
});

describe("xpToLevel", () => {
  it("starts at level 0", () => {
    const r = xpToLevel(0);
    expect(r.level).toBe(0);
    expect(r.xpInLevel).toBe(0);
    expect(r.levelTitle).toBe(LEVEL_TITLES[0]);
  });

  it("promotes exactly at a threshold, not one XP later", () => {
    const t = LEVEL_XP_THRESHOLDS[1];
    expect(xpToLevel(t - 1).level).toBe(0);
    expect(xpToLevel(t).level).toBe(1);
  });

  it.each(LEVEL_XP_THRESHOLDS.map((xp, i) => [xp, i] as const))(
    "%i XP is level %i",
    (xp, level) => {
      expect(xpToLevel(xp).level).toBe(level);
    },
  );

  it("reports remaining XP to the next level", () => {
    const r = xpToLevel(LEVEL_XP_THRESHOLDS[1]);
    expect(r.xpToNextLevel).toBe(LEVEL_XP_THRESHOLDS[2] - LEVEL_XP_THRESHOLDS[1]);
  });

  it("caps at the last level with nothing left to earn", () => {
    const last = LEVEL_XP_THRESHOLDS.length - 1;
    const r = xpToLevel(LEVEL_XP_THRESHOLDS[last] + 999_999);
    expect(r.level).toBe(last);
    expect(r.xpToNextLevel).toBe(0);
    expect(r.levelTitle).toBe(LEVEL_TITLES[last]);
  });

  it("does not go below level 0 for negative XP", () => {
    expect(xpToLevel(-100).level).toBe(0);
  });
});

describe("levelToXp", () => {
  it("round-trips with xpToLevel", () => {
    for (let i = 0; i < LEVEL_XP_THRESHOLDS.length; i++) {
      expect(xpToLevel(levelToXp(i)).level).toBe(i);
    }
  });

  it("clamps past the last level", () => {
    const last = LEVEL_XP_THRESHOLDS.length - 1;
    expect(levelToXp(99)).toBe(LEVEL_XP_THRESHOLDS[last]);
  });
});
