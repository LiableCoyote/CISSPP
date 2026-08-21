import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { format, subDays } from "date-fns";
import { db, type Profile } from "../db/schema";
import { logStudySession, applyStudySession } from "./session";
import { publishLastActive } from "./reminders";

// The Cache API is absent in the node environment, so the real function returns
// early and asserting on its effect is impossible. Mocking it is the only way to
// see *whether it was called* — which is the property that matters here.
vi.mock("./reminders", () => ({
  publishLastActive: vi.fn(async () => {}),
}));

const today = () => format(new Date(), "yyyy-MM-dd");
const yesterday = () => format(subDays(new Date(), 1), "yyyy-MM-dd");

function profile(over: Partial<Profile> = {}): Profile {
  return {
    id: 1,
    displayName: "T",
    examDate: null,
    dailyGoalMinutes: 120,
    startDate: new Date().toISOString(),
    xp: 0,
    streak: 0,
    longestStreak: 0,
    streakFreezesUsedThisWeek: 0,
    streakWeekKey: "",
    lastActiveDate: null,
    mindsetChoicesCorrect: 0,
    technicianMisses: 0,
    speedReaderMisses: 0,
    createdAt: new Date().toISOString(),
    ...over,
  };
}

beforeEach(async () => {
  await db.studyLog.clear();
  vi.mocked(publishLastActive).mockClear();
});

/**
 * The split that makes an atomic award possible.
 *
 * `publishLastActive` is a Cache API write, and a Dexie transaction does not
 * survive a non-Dexie await — so as long as it sat inside the logging helper,
 * no award could wrap the claim and the credit in one transaction. Moving it to
 * the wrapper is load-bearing rather than tidying, and these two assertions are
 * what keep it from drifting back.
 */
describe("applyStudySession — the transaction-safe half", () => {
  it("writes the day's row and returns the streak patch", async () => {
    const patch = await applyStudySession(profile({ lastActiveDate: yesterday(), streak: 3 }), {
      minutes: 25,
    });
    expect((await db.studyLog.get(today()))?.minutes).toBe(25);
    expect(patch.streak).toBe(4);
  });

  it("touches nothing outside Dexie", async () => {
    await applyStudySession(profile(), { minutes: 25 });
    expect(publishLastActive).not.toHaveBeenCalled();
  });

  it("and the wrapper still publishes, so the worker's reminder state stays current", async () => {
    await logStudySession(profile(), { minutes: 25 });
    expect(publishLastActive).toHaveBeenCalledWith(today());
  });

  // It used to publish before the already-counted-today early return, so a
  // second session on the same day still refreshed the reminder state.
  it("publishes on a second session the same day too", async () => {
    const p = profile({ lastActiveDate: today() });
    await logStudySession(p, { minutes: 10 });
    await logStudySession(p, { minutes: 10 });
    expect(publishLastActive).toHaveBeenCalledTimes(2);
  });
});

describe("logStudySession — the study log", () => {
  it("creates the day's row on a first session", async () => {
    await logStudySession(profile(), { minutes: 25 });
    const row = await db.studyLog.get(today());
    expect(row?.minutes).toBe(25);
    expect(row?.sessions).toBe(1);
  });

  it("accumulates into an existing day", async () => {
    await logStudySession(profile(), { minutes: 25 });
    await logStudySession(profile({ lastActiveDate: today() }), { minutes: 10, flashcardsReviewed: 4 });
    const row = await db.studyLog.get(today());
    expect(row?.minutes).toBe(35);
    expect(row?.sessions).toBe(2);
    expect(row?.flashcardsReviewed).toBe(4);
  });

  it("credits at least a minute for a very short session", async () => {
    await logStudySession(profile(), { minutes: 0.2 });
    expect((await db.studyLog.get(today()))?.minutes).toBe(1);
  });

  it("tracks quests separately from cards", async () => {
    await logStudySession(profile(), { minutes: 20, questsCompleted: 1 });
    const row = await db.studyLog.get(today());
    expect(row?.questsCompleted).toBe(1);
    expect(row?.flashcardsReviewed).toBe(0);
  });
});

describe("logStudySession — the streak", () => {
  it("starts a streak at 1 for a first-ever session", async () => {
    const patch = await logStudySession(profile(), { minutes: 10 });
    expect(patch.streak).toBe(1);
    expect(patch.lastActiveDate).toBe(today());
    expect(patch.longestStreak).toBe(1);
  });

  it("continues a streak from yesterday", async () => {
    const patch = await logStudySession(
      profile({ lastActiveDate: yesterday(), streak: 4, longestStreak: 4 }),
      { minutes: 10 },
    );
    expect(patch.streak).toBe(5);
    expect(patch.longestStreak).toBe(5);
  });

  it("resets a streak after a gap", async () => {
    const patch = await logStudySession(
      profile({ lastActiveDate: format(subDays(new Date(), 4), "yyyy-MM-dd"), streak: 9, longestStreak: 9 }),
      { minutes: 10 },
    );
    expect(patch.streak).toBe(1);
    // The record survives the reset.
    expect(patch.longestStreak).toBe(9);
  });

  it("does not advance twice in one day", async () => {
    const patch = await logStudySession(profile({ lastActiveDate: today(), streak: 3 }), {
      minutes: 10,
    });
    expect(patch).toEqual({});
  });

  it("still writes the study log on a second same-day session", async () => {
    await logStudySession(profile(), { minutes: 10 });
    await logStudySession(profile({ lastActiveDate: today(), streak: 1 }), { minutes: 15 });
    expect((await db.studyLog.get(today()))?.minutes).toBe(25);
  });
});
