import { describe, it, expect } from "vitest";
import { sm2, nextReviewDate } from "./srs";

const fresh = { ease: 2.5, interval: 0, reps: 0, lapses: 0 };

describe("sm2", () => {
  it("resets the interval and counts a lapse on a failed review", () => {
    const out = sm2({ ease: 2.5, interval: 30, reps: 5, lapses: 1 }, 1);
    expect(out.interval).toBe(1);
    expect(out.reps).toBe(0);
    expect(out.lapses).toBe(2);
  });

  it("never lets ease fall below 1.3", () => {
    let state = fresh;
    for (let i = 0; i < 25; i++) state = sm2(state, 0);
    expect(state.ease).toBeGreaterThanOrEqual(1.3);
  });

  it("grows the interval across successive good reviews", () => {
    let state = fresh;
    const intervals: number[] = [];
    for (let i = 0; i < 5; i++) {
      state = sm2(state, 4);
      intervals.push(state.interval);
    }
    for (let i = 1; i < intervals.length; i++) {
      expect(intervals[i]).toBeGreaterThanOrEqual(intervals[i - 1]);
    }
    expect(intervals.at(-1)!).toBeGreaterThan(1);
  });

  it("increments reps on a passing grade", () => {
    expect(sm2(fresh, 3).reps).toBe(1);
  });
});

describe("nextReviewDate", () => {
  it("advances by whole days", () => {
    const from = new Date("2026-03-10T09:00:00");
    expect(nextReviewDate(from, 5).getDate()).toBe(15);
  });

  it("rolls over a month boundary", () => {
    const from = new Date("2026-01-30T09:00:00");
    const next = nextReviewDate(from, 3);
    expect(next.getMonth()).toBe(1); // February
    expect(next.getDate()).toBe(2);
  });

  it("rolls over a year boundary", () => {
    const next = nextReviewDate(new Date("2026-12-30T09:00:00"), 5);
    expect(next.getFullYear()).toBe(2027);
  });

  it("does not mutate the input", () => {
    const from = new Date("2026-03-10T09:00:00");
    const before = from.getTime();
    nextReviewDate(from, 7);
    expect(from.getTime()).toBe(before);
  });

  it("returns the same day for a zero interval", () => {
    const from = new Date("2026-03-10T09:00:00");
    expect(nextReviewDate(from, 0).getDate()).toBe(10);
  });
});
