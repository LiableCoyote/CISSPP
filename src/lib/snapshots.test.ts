import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { db, type Profile } from "../db/schema";
import { createSnapshotOrThrow, listSnapshots, maybeDailySnapshot } from "./snapshots";
import { getItem, setItem } from "./safeStorage";

/**
 * These tests run in the node environment, where there is no `window`, so
 * safeStorage correctly degrades to a no-op and the daily key never persists.
 * Mocking the module rather than faking a `window` global keeps Dexie and
 * fake-indexeddb seeing the environment they actually expect.
 */
vi.mock("./safeStorage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./safeStorage")>();
  const mem = new Map<string, string>();
  return {
    ...actual,
    getItem: (key: string) => mem.get(key) ?? null,
    setItem: (key: string, value: string) => {
      mem.set(key, value);
      return true;
    },
  };
});
import * as exportModule from "./export";

function profile(): Profile {
  const now = new Date().toISOString();
  return {
    id: 1,
    displayName: "T",
    examDate: null,
    dailyGoalMinutes: 120,
    startDate: now,
    xp: 0,
    streak: 0,
    longestStreak: 0,
    streakFreezesUsedThisWeek: 0,
    streakWeekKey: "",
    lastActiveDate: null,
    mindsetChoicesCorrect: 0,
    technicianMisses: 0,
    speedReaderMisses: 0,
    createdAt: now,
  };
}

beforeEach(async () => {
  await db.snapshots.clear();
  await db.profile.put(profile());
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createSnapshotOrThrow", () => {
  it("writes a snapshot with a real byte size", async () => {
    const snap = await createSnapshotOrThrow("daily");
    expect(snap.reason).toBe("daily");
    expect(snap.sizeBytes).toBeGreaterThan(0);
    // Blob bytes, not UTF-16 code units — the content is emoji-heavy, so the
    // byte count must be at least the string length.
    expect(snap.sizeBytes).toBeGreaterThanOrEqual(snap.payload.length);
    expect(await db.snapshots.count()).toBe(1);
  });

  // The bug this guards: the import path discarded createSnapshot's null return,
  // so a snapshot failing under quota let the destructive restore run anyway,
  // right after the UI promised a backup had been taken.
  it("propagates a failure instead of returning null", async () => {
    vi.spyOn(exportModule, "exportData").mockRejectedValue(new Error("QuotaExceededError"));
    await expect(createSnapshotOrThrow("pre-import")).rejects.toThrow(/quota/i);
    expect(await db.snapshots.count()).toBe(0);
  });

  it("keeps only the newest few", async () => {
    for (let i = 0; i < 6; i++) await createSnapshotOrThrow("daily");
    expect(await db.snapshots.count()).toBeLessThanOrEqual(3);
  });

  it("gives each snapshot a distinct id even in the same millisecond", async () => {
    const [a, b] = await Promise.all([
      createSnapshotOrThrow("daily"),
      createSnapshotOrThrow("daily"),
    ]);
    expect(a.id).not.toBe(b.id);
  });

  it("lists newest first", async () => {
    await createSnapshotOrThrow("daily");
    await new Promise((r) => setTimeout(r, 5));
    await createSnapshotOrThrow("pre-import");
    const list = await listSnapshots();
    expect(list[0].reason).toBe("pre-import");
  });
});

/**
 * The daily snapshot used to go through a best-effort wrapper that logged the
 * failure and returned null. That helper is gone: it was wrong twice over — the
 * user was never told their automatic backups had stopped, and the day was
 * marked done anyway, so the failure was not even retried on the next launch.
 */
describe("maybeDailySnapshot", () => {
  const key = "cisspp-last-snapshot-day-default";

  beforeEach(() => {
    setItem(key, "");
  });

  it("takes one snapshot and marks the day", async () => {
    await maybeDailySnapshot();
    expect(await db.snapshots.count()).toBe(1);
    expect(getItem(key)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("does not take a second one the same day", async () => {
    await maybeDailySnapshot();
    await maybeDailySnapshot();
    expect(await db.snapshots.count()).toBe(1);
  });

  it("propagates a failure so the caller can report it", async () => {
    vi.spyOn(exportModule, "exportData").mockRejectedValue(new Error("QuotaExceededError"));
    await expect(maybeDailySnapshot()).rejects.toThrow(/quota/i);
  });

  // The second half of the same defect: a failed snapshot that still marks the
  // day means no backup today and no retry either.
  it("leaves the day unmarked when it fails, so the next launch tries again", async () => {
    const spy = vi.spyOn(exportModule, "exportData").mockRejectedValue(new Error("nope"));
    await expect(maybeDailySnapshot()).rejects.toThrow();
    expect(getItem(key)).toBe("");

    spy.mockRestore();
    await maybeDailySnapshot();
    expect(await db.snapshots.count()).toBe(1);
  });

  it("does nothing on a fresh install with no profile", async () => {
    await db.profile.clear();
    await maybeDailySnapshot();
    expect(await db.snapshots.count()).toBe(0);
    expect(getItem(key)).toBe("");
  });
});
