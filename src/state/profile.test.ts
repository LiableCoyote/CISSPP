import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { db, type Profile } from "../db/schema";
import { useProfile } from "./profile";

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

const addXp = () => useProfile.getState().addXp;

beforeEach(async () => {
  await db.profile.clear();
  await db.achievements.clear();
  await db.profile.put(profile());
  await useProfile.getState().refreshProfile();
});

/**
 * Every award used to compute `profile.xp + delta` from a React render or a
 * store read and write that absolute total back. `unlock()` in the achievement
 * engine reads the row fresh and adds badge XP, so anything landing between the
 * read and the write was silently overwritten — and two awards in the same tick
 * lost one of themselves the same way.
 */
describe("addXp", () => {
  it("adds to the stored total", async () => {
    await addXp()(100);
    expect((await db.profile.get(1))?.xp).toBe(100);
    expect(useProfile.getState().profile?.xp).toBe(100);
  });

  // The lost update, asserted rather than argued about.
  it("keeps both amounts when two awards land together", async () => {
    await Promise.all([addXp()(100), addXp()(50)]);
    expect((await db.profile.get(1))?.xp).toBe(150);
  });

  it("survives a write that landed after the store was last read", async () => {
    // A badge unlocking writes straight to Dexie without going through here.
    await db.profile.update(1, { xp: 500 });
    await addXp()(100);
    expect((await db.profile.get(1))?.xp).toBe(600);
  });

  it("applies an accompanying patch in the same write", async () => {
    await addXp()(30, { streak: 4, longestStreak: 4 });
    const p = await db.profile.get(1);
    expect(p?.xp).toBe(30);
    expect(p?.streak).toBe(4);
  });

  it("subtracts on a negative delta", async () => {
    await db.profile.update(1, { xp: 200 });
    await addXp()(-75);
    expect((await db.profile.get(1))?.xp).toBe(125);
  });

  it("clamps at zero rather than going negative", async () => {
    await db.profile.update(1, { xp: 10 });
    await addXp()(-500);
    expect((await db.profile.get(1))?.xp).toBe(0);
  });

  it("does nothing when there is no profile row yet", async () => {
    await db.profile.clear();
    await expect(addXp()(50)).resolves.toBeUndefined();
    expect(await db.profile.count()).toBe(0);
  });
});
