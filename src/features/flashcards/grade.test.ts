import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { db, type Flashcard, type Profile } from "../../db/schema";
import { gradeCard } from "./grade";
import { flashcardXp } from "../../lib/rewards";

const SESSION_START = "2026-06-01T10:00:00.000Z";
const BEFORE_SESSION = "2026-05-31T10:00:00.000Z";

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

function card(over: Partial<Flashcard> = {}): Flashcard {
  return {
    id: "c1",
    front: "f",
    back: "b",
    domainId: 1,
    tags: [],
    ease: 2.5,
    interval: 0,
    reps: 0,
    lapses: 0,
    dueAt: BEFORE_SESSION,
    lastReviewedAt: null,
    createdAt: BEFORE_SESSION,
    source: "seed",
    ...over,
  };
}

/** Fails writes to one store, leaving the rest working. */
function breakStore(name: string) {
  const realAdd = IDBObjectStore.prototype.add;
  const realPut = IDBObjectStore.prototype.put;
  const guard = (fn: typeof realAdd) =>
    function (this: IDBObjectStore, ...args: unknown[]) {
      if (this.name === name) throw new Error("QuotaExceededError");
      return (fn as (...a: unknown[]) => IDBRequest).apply(this, args);
    } as typeof realAdd;
  IDBObjectStore.prototype.add = guard(realAdd);
  IDBObjectStore.prototype.put = guard(realPut);
  return () => {
    IDBObjectStore.prototype.add = realAdd;
    IDBObjectStore.prototype.put = realPut;
  };
}

beforeEach(async () => {
  await db.flashcards.clear();
  await db.studyLog.clear();
  await db.profile.clear();
  await db.profile.put(profile());
  await db.flashcards.put(card());
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("gradeCard", () => {
  it("advances the schedule, adds the XP and logs the review", async () => {
    expect(await gradeCard("c1", 3, SESSION_START)).toBe("graded");

    const row = await db.flashcards.get("c1");
    expect(row?.reps).toBe(1);
    expect(row!.dueAt > SESSION_START).toBe(true);
    expect(row?.lastReviewedAt).toBeTruthy();

    expect((await db.profile.get(1))?.xp).toBe(flashcardXp(3));
    const log = await db.studyLog.toArray();
    expect(log).toHaveLength(1);
    expect(log[0].flashcardsReviewed).toBe(1);
  });

  /**
   * The defect this module exists for. grade() awaited four round-trips with
   * the keyboard handler still live and `card` taken from a live query that had
   * not caught up, so two quick presses graded the same card twice: sm2() ran
   * twice from the same starting values, XP paid twice, and flashcardsReviewed
   * double-counted into the flashcard-100/500 badges.
   */
  it("refuses a second grade in the same session, changing nothing", async () => {
    await gradeCard("c1", 3, SESSION_START);
    const afterFirst = await db.flashcards.get("c1");
    const xpAfterFirst = (await db.profile.get(1))?.xp;
    const logAfterFirst = await db.studyLog.toArray();

    expect(await gradeCard("c1", 3, SESSION_START)).toBe("already");

    expect(await db.flashcards.get("c1")).toEqual(afterFirst);
    expect((await db.profile.get(1))?.xp).toBe(xpAfterFirst);
    expect(await db.studyLog.toArray()).toEqual(logAfterFirst);
  });

  it("refuses it whatever grade the second press asks for", async () => {
    await gradeCard("c1", 4, SESSION_START);
    const afterFirst = await db.flashcards.get("c1");
    expect(await gradeCard("c1", 0, SESSION_START)).toBe("already");
    expect(await db.flashcards.get("c1")).toEqual(afterFirst);
  });

  // The guard must not block tomorrow's genuine review.
  it("grades a card last reviewed before this session", async () => {
    await db.flashcards.put(card({ lastReviewedAt: BEFORE_SESSION }));
    expect(await gradeCard("c1", 3, SESSION_START)).toBe("graded");
    expect((await db.profile.get(1))?.xp).toBe(flashcardXp(3));
  });

  it("rolls everything back when a write fails", async () => {
    const before = await db.flashcards.get("c1");
    const restore = breakStore("flashcards");

    await expect(gradeCard("c1", 3, SESSION_START)).rejects.toThrow();
    restore();

    expect(await db.flashcards.get("c1")).toEqual(before);
    expect((await db.profile.get(1))?.xp).toBe(0);
    expect(await db.studyLog.count()).toBe(0);
  });

  it("and the retry then works, paying exactly once", async () => {
    const restore = breakStore("flashcards");
    await expect(gradeCard("c1", 3, SESSION_START)).rejects.toThrow();
    restore();

    expect(await gradeCard("c1", 3, SESSION_START)).toBe("graded");
    expect((await db.profile.get(1))?.xp).toBe(flashcardXp(3));
  });

  it("reports a missing card rather than throwing", async () => {
    await db.flashcards.clear();
    expect(await gradeCard("c1", 3, SESSION_START)).toBe("missing");
  });

  // The XP total comes from the stored row, so a badge unlocking alongside this
  // is not overwritten.
  it("adds to whatever XP is stored, not to a snapshot", async () => {
    await db.profile.update(1, { xp: 500 });
    await gradeCard("c1", 3, SESSION_START);
    expect((await db.profile.get(1))?.xp).toBe(500 + flashcardXp(3));
  });

  it("advances the streak through the shared session helper", async () => {
    await db.profile.update(1, { lastActiveDate: null, streak: 0 });
    await gradeCard("c1", 3, SESSION_START);
    expect((await db.profile.get(1))?.streak).toBe(1);
  });

  // A failing grade lapses the card rather than advancing it — the SM-2 rule,
  // unchanged by the move.
  it("keeps the SM-2 rules: a blackout resets the interval and counts a lapse", async () => {
    await db.flashcards.put(card({ reps: 5, interval: 30, lapses: 1 }));
    await gradeCard("c1", 0, SESSION_START);
    const row = await db.flashcards.get("c1");
    expect(row?.reps).toBe(0);
    expect(row?.interval).toBe(1);
    expect(row?.lapses).toBe(2);
  });
});
