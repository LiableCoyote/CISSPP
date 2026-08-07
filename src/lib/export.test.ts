import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { db, type Flashcard } from "../db/schema";
import { exportData, importData, validateBackup, EXPORT_VERSION } from "./export";

function card(id: string): Flashcard {
  const now = new Date().toISOString();
  return {
    id,
    front: `front-${id}`,
    back: `back-${id}`,
    domainId: 1,
    tags: ["t"],
    ease: 2.5,
    interval: 0,
    reps: 0,
    lapses: 0,
    dueAt: now,
    lastReviewedAt: null,
    createdAt: now,
    source: "seed",
  };
}

/** Seeds a small known dataset and returns the flashcard row count. */
async function seed() {
  await db.flashcards.clear();
  await db.notes.clear();
  // A backup must carry exactly one profile row — see validateBackup.
  await db.profile.put({
    id: 1,
    displayName: "Test",
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
  });
  await db.flashcards.bulkAdd([card("a"), card("b"), card("c")]);
  await db.notes.add({
    id: "n1",
    domainId: 1,
    title: "Note",
    body: "Body",
    updatedAt: new Date().toISOString(),
  });
  return db.flashcards.count();
}

describe("validateBackup", () => {
  it("accepts a real export", async () => {
    await seed();
    const good = await exportData();
    expect(() => validateBackup(good)).not.toThrow();
  });

  it("rejects a non-object", () => {
    expect(() => validateBackup([1, 2, 3])).toThrow(/valid backup/i);
    expect(() => validateBackup(null)).toThrow(/valid backup/i);
    expect(() => validateBackup("nope")).toThrow(/valid backup/i);
  });

  it("rejects an unknown version", () => {
    expect(() => validateBackup({ version: 99, flashcards: [card("x")] })).toThrow(/version/i);
    expect(() => validateBackup({ version: 0, flashcards: [card("x")] })).toThrow(/version/i);
    expect(() => validateBackup({ version: "1", flashcards: [card("x")] })).toThrow(/version/i);
  });

  it("rejects a non-object settings block", () => {
    expect(() =>
      validateBackup({ version: EXPORT_VERSION, flashcards: [card("x")], settings: [] }),
    ).toThrow(/settings/);
  });

  it("rejects a table that is not a list", () => {
    expect(() => validateBackup({ version: EXPORT_VERSION, flashcards: { a: 1 } })).toThrow(
      /flashcards/,
    );
  });

  it("rejects a payload with no rows at all", () => {
    // The case that used to wipe the database and write nothing back.
    expect(() => validateBackup({ version: EXPORT_VERSION })).toThrow(/empty/i);
  });

  // Without a profile the import "succeeds", then the post-import reload sees
  // an empty profile table, treats it as a fresh install and re-seeds over it —
  // so the user's file is silently discarded.
  it("rejects a payload with no profile row", () => {
    expect(() => validateBackup({ version: EXPORT_VERSION, flashcards: [card("x")] })).toThrow(
      /profile/i,
    );
  });

  // v1 files predate vaultWins and the settings block. Rejecting them would
  // strand every backup a user has already downloaded.
  it("still accepts a version 1 backup", async () => {
    await seed();
    const good = await exportData();
    const v1: Record<string, unknown> = { ...good, version: 1 };
    delete v1.vaultWins;
    delete v1.settings;
    expect(() => validateBackup(v1)).not.toThrow();
  });

  it("rejects a payload with more than one profile row", async () => {
    const good = await exportData();
    const two = { ...good, profile: [...(good.profile as unknown[]), { id: 2 }] };
    expect(() => validateBackup(two)).toThrow(/profile/i);
  });
});

describe("importData", () => {
  beforeEach(async () => {
    await seed();
  });

  it("round-trips an export without changing the data", async () => {
    const before = await db.flashcards.toArray();
    const backup = await exportData();
    await importData(JSON.stringify(backup));
    const after = await db.flashcards.toArray();
    expect(after).toHaveLength(before.length);
    expect(after.map((c) => c.id).sort()).toEqual(before.map((c) => c.id).sort());
    expect(await db.notes.count()).toBe(1);
  });

  it("replaces existing rows rather than merging", async () => {
    const backup = await exportData();
    await db.flashcards.add(card("extra"));
    expect(await db.flashcards.count()).toBe(4);
    await importData(JSON.stringify(backup));
    expect(await db.flashcards.count()).toBe(3);
  });

  // Regression: vaultWins backs the bia-first achievement but was left out of
  // BACKUP_TABLES, so a reset destroyed it after promising a backup, and an
  // import left the old device's wins mixed into the restored data.
  it("round-trips vault wins", async () => {
    await db.vaultWins.clear();
    await db.vaultWins.put({ gameId: "bcp-steps", wins: 4, lastWonAt: new Date().toISOString() });

    const backup = await exportData();
    expect(backup.vaultWins).toHaveLength(1);

    await db.vaultWins.clear();
    await importData(JSON.stringify(backup));

    const restored = await db.vaultWins.get("bcp-steps");
    expect(restored?.wins).toBe(4);
  });

  it("clears vault wins that the backup does not contain", async () => {
    await db.vaultWins.clear();
    const backup = await exportData(); // no wins recorded
    await db.vaultWins.put({ gameId: "osi-layers", wins: 9, lastWonAt: new Date().toISOString() });

    await importData(JSON.stringify(backup));
    expect(await db.vaultWins.count()).toBe(0);
  });

  it("imports a version 1 payload with no vaultWins block", async () => {
    const backup = await exportData();
    const v1 = { ...backup, version: 1 };
    delete (v1 as Record<string, unknown>).vaultWins;
    delete (v1 as Record<string, unknown>).settings;

    await expect(importData(JSON.stringify(v1))).resolves.toBeUndefined();
    expect(await db.flashcards.count()).toBe(3);
  });

  it.each([
    ["invalid JSON", "{{{"],
    ["empty payload", JSON.stringify({ version: EXPORT_VERSION })],
    ["wrong version", JSON.stringify({ version: 99, flashcards: [card("x")] })],
    ["non-array table", JSON.stringify({ version: EXPORT_VERSION, flashcards: { a: 1 } })],
    ["JSON array", JSON.stringify([1, 2, 3])],
  ])("rejects %s and leaves the data intact", async (_label, payload) => {
    const before = await db.flashcards.count();
    await expect(importData(payload)).rejects.toThrow();
    expect(await db.flashcards.count()).toBe(before);
    expect(await db.notes.count()).toBe(1);
  });

  it("rolls back when a write fails partway through", async () => {
    // Duplicate primary keys make bulkAdd throw after the clear has run. Before
    // the transaction was added this left every table empty.
    const before = await db.flashcards.count();
    const payload = JSON.stringify({
      version: EXPORT_VERSION,
      flashcards: [card("dup"), card("dup")],
    });
    await expect(importData(payload)).rejects.toThrow();
    expect(await db.flashcards.count()).toBe(before);
    expect(await db.notes.count()).toBe(1);
  });
});
