import { describe, it, expect } from "vitest";
import {
  isSpeedReader,
  isTechnicianAnswer,
  getSpeedReaderNudge,
  getTechnicianNudge,
} from "./detectors";

describe("isSpeedReader", () => {
  it("flags an implausibly fast answer", () => {
    expect(isSpeedReader(1_000)).toBe(true);
  });

  it("does not flag a considered answer", () => {
    expect(isSpeedReader(60_000)).toBe(false);
  });

  it("is monotonic — slower is never more suspicious", () => {
    const times = [0, 500, 1_000, 5_000, 10_000, 60_000];
    const flags = times.map(isSpeedReader);
    const firstFalse = flags.indexOf(false);
    if (firstFalse !== -1) {
      expect(flags.slice(firstFalse).every((f) => f === false)).toBe(true);
    }
  });
});

describe("isTechnicianAnswer", () => {
  const mindsetQ = { isMindsetHeavy: true, technicianTrap: 2 as const };

  it("flags the trap option on a mindset question", () => {
    expect(isTechnicianAnswer(mindsetQ, 2)).toBe(true);
  });

  it("does not flag other options", () => {
    expect(isTechnicianAnswer(mindsetQ, 0)).toBe(false);
    expect(isTechnicianAnswer(mindsetQ, 3)).toBe(false);
  });

  it("does not flag questions that aren't mindset-heavy", () => {
    expect(isTechnicianAnswer({ isMindsetHeavy: false, technicianTrap: 2 }, 2)).toBe(false);
  });

  it("does not flag when no trap is defined", () => {
    expect(isTechnicianAnswer({ isMindsetHeavy: true }, 0)).toBe(false);
  });

  it("treats option 0 as a real trap index, not a falsy value", () => {
    expect(isTechnicianAnswer({ isMindsetHeavy: true, technicianTrap: 0 }, 0)).toBe(true);
  });
});

describe("nudges", () => {
  it.each([
    ["speed reader", getSpeedReaderNudge],
    ["technician", getTechnicianNudge],
  ])("%s nudge always returns non-empty text", (_label, fn) => {
    for (let i = 0; i < 30; i++) {
      const text = fn();
      expect(typeof text).toBe("string");
      expect(text.length).toBeGreaterThan(10);
    }
  });
});
