import { describe, it, expect } from "vitest";
import { getWeekKey } from "./streak";

describe("getWeekKey", () => {
  // The old implementation divided day-of-month by 7, so any date in the first
  // seven days of any month collided on "W01" and the weekly streak-freeze
  // allowance reset at arbitrary times.
  it("does not collide across months", () => {
    expect(getWeekKey(new Date("2026-01-03T12:00:00Z"))).not.toBe(
      getWeekKey(new Date("2026-02-05T12:00:00Z")),
    );
  });

  it("gives the same key to every day of one ISO week", () => {
    // Mon 2026-01-05 through Sun 2026-01-11.
    const keys = ["05", "06", "07", "08", "09", "10", "11"].map((d) =>
      getWeekKey(new Date(`2026-01-${d}T12:00:00Z`)),
    );
    expect(new Set(keys).size).toBe(1);
  });

  it("changes key across an ISO week boundary", () => {
    const sunday = getWeekKey(new Date("2026-01-11T12:00:00Z"));
    const monday = getWeekKey(new Date("2026-01-12T12:00:00Z"));
    expect(sunday).not.toBe(monday);
  });

  it("formats as YYYY-Www", () => {
    expect(getWeekKey(new Date("2026-01-05T12:00:00Z"))).toMatch(/^\d{4}-W\d{2}$/);
  });

  it("uses the ISO week-year at a year boundary", () => {
    // 2026-12-31 is a Thursday, in ISO week 53 of 2026.
    expect(getWeekKey(new Date("2026-12-31T12:00:00Z"))).toBe("2026-W53");
  });
});
