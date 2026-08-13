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

describe("syncSeedContent — corrections reach existing users", () => {
  // The sync was add-only, keyed on a missing id. A corrected question keeps
  // its id, so before this every existing user kept the wrong version forever
  // and the content audit shipped to nobody.
  it("overwrites a stale question with the shipped one", async () => {
    await syncSeedContent();
    const target = ALL_QUESTIONS[0];
    await db.questions.put({ ...target, prompt: "STALE WORDING", explanation: "stale" });

    await syncSeedContent();

    const after = await db.questions.get(target.id);
    expect(after?.prompt).toBe(target.prompt);
    expect(after?.explanation).toBe(target.explanation);
  });

  it("does not multiply rows when refreshing", async () => {
    await syncSeedContent();
    const before = await db.questions.count();
    await syncSeedContent();
    expect(await db.questions.count()).toBe(before);
  });

  // The other half of the contract: refreshing content must not reset progress.
  it("refreshes card text while leaving its SRS schedule alone", async () => {
    await syncSeedContent();
    const card = (await db.flashcards.where("source").equals("seed").first())!;
    await db.flashcards.update(card.id, {
      front: "STALE FRONT",
      ease: 1.9,
      interval: 21,
      reps: 5,
      dueAt: "2099-01-01T00:00:00.000Z",
    });

    await syncSeedContent();

    const after = await db.flashcards.get(card.id);
    expect(after?.front).toBe(card.front);
    // Scheduling is the user's, and stays theirs.
    expect(after?.ease).toBe(1.9);
    expect(after?.interval).toBe(21);
    expect(after?.reps).toBe(5);
    expect(after?.dueAt).toBe("2099-01-01T00:00:00.000Z");
  });

  it("leaves user-authored cards untouched", async () => {
    await syncSeedContent();
    const now = new Date().toISOString();
    await db.flashcards.add({
      id: "user-card-1",
      front: "My own card",
      back: "My own answer",
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

    const mine = await db.flashcards.get("user-card-1");
    expect(mine?.front).toBe("My own card");
  });
});
