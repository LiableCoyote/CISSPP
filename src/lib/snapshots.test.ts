import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { db, type Profile } from "../db/schema";
import { createSnapshot, createSnapshotOrThrow, listSnapshots } from "./snapshots";
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

describe("createSnapshot (best-effort)", () => {
  it("returns null rather than throwing, for background use", async () => {
    vi.spyOn(exportModule, "exportData").mockRejectedValue(new Error("nope"));
    await expect(createSnapshot("daily")).resolves.toBeNull();
  });
});
