import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { db } from "./schema";
import { syncSeedContent } from "./seed";
import { buildFlashcardSeed } from "../data/flashcards.seed";
import { ALL_QUESTIONS } from "../data/questions.seed";

beforeEach(async () => {
  await Promise.all([db.flashcards.clear(), db.questions.clear(), db.resources.clear()]);
});

describe("syncSeedContent", () => {
  it("populates an empty database", async () => {
    await syncSeedContent();
    expect(await db.flashcards.count()).toBe(buildFlashcardSeed().length);
    expect(await db.questions.count()).toBe(ALL_QUESTIONS.length);
    expect(await db.resources.count()).toBeGreaterThan(0);
  });

  it("is idempotent — a second run adds nothing", async () => {
    await syncSeedContent();
    const counts = {
      cards: await db.flashcards.count(),
      questions: await db.questions.count(),
      resources: await db.resources.count(),
    };
    await syncSeedContent();
    expect(await db.flashcards.count()).toBe(counts.cards);
    expect(await db.questions.count()).toBe(counts.questions);
    expect(await db.resources.count()).toBe(counts.resources);
  });

  // The contract that matters: shipping new content must not reset the SRS
  // state a user has built up on the cards they already had.
  it("preserves review progress on existing cards", async () => {
    await syncSeedContent();
    const [first] = await db.flashcards.toArray();
    await db.flashcards.update(first.id, {
      ease: 1.9,
      interval: 21,
      reps: 7,
      lapses: 2,
      dueAt: "2027-01-01T00:00:00.000Z",
      lastReviewedAt: "2026-01-01T00:00:00.000Z",
    });

    await syncSeedContent();

    const after = await db.flashcards.get(first.id);
    expect(after?.ease).toBe(1.9);
    expect(after?.interval).toBe(21);
    expect(after?.reps).toBe(7);
    expect(after?.lapses).toBe(2);
    expect(after?.dueAt).toBe("2027-01-01T00:00:00.000Z");
  });

  it("preserves watched flags on resources", async () => {
    await syncSeedContent();
    const [first] = await db.resources.toArray();
    await db.resources.update(first.id, { watched: true });
    await syncSeedContent();
    expect((await db.resources.get(first.id))?.watched).toBe(true);
  });

  it("backfills only the rows that are missing", async () => {
    await syncSeedContent();
    const before = await db.flashcards.count();
    const [a, b] = await db.flashcards.toArray();
    await db.flashcards.bulkDelete([a.id, b.id]);
    expect(await db.flashcards.count()).toBe(before - 2);

    await syncSeedContent();
    expect(await db.flashcards.count()).toBe(before);
  });

  it("does not leave user-created cards behind", async () => {
    await syncSeedContent();
    const now = new Date().toISOString();
    await db.flashcards.add({
      id: "user-1",
      front: "mine",
      back: "mine",
      domainId: 1,
      tags: [],
      ease: 2.5,
      interval: 0,
      reps: 0,
      lapses: 0,
      dueAt: now,
      lastReviewedAt: null,
      createdAt: now,
      source: "user",
    });
    await syncSeedContent();
    expect(await db.flashcards.get("user-1")).toBeDefined();
  });
});
