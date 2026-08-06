import { db } from "./schema";
import { DOMAINS } from "../data/domains";
import { QUEST_SEEDS } from "../data/weeks";
import { buildFlashcardSeed } from "../data/flashcards.seed";
import { ALL_QUESTIONS } from "../data/questions.seed";
import { RESOURCES } from "../data/resources";
import { getWeekKey } from "../lib/streak";
import type { Profile, Quest } from "./schema";

/**
 * Adds content shipped after the user's DB was first seeded. Only inserts rows
 * whose id is missing, so existing SRS progress, quiz history and watched flags
 * are never touched.
 */
async function syncSeedContent() {
  const now = new Date().toISOString();

  const cardIds = new Set(await db.flashcards.toCollection().primaryKeys());
  const newCards = buildFlashcardSeed().filter((c) => !cardIds.has(c.id));
  if (newCards.length > 0) await db.flashcards.bulkAdd(newCards);

  const questionIds = new Set(await db.questions.toCollection().primaryKeys());
  const newQuestions = ALL_QUESTIONS.filter((q) => !questionIds.has(q.id));
  if (newQuestions.length > 0) await db.questions.bulkAdd(newQuestions);

  const resourceIds = new Set(await db.resources.toCollection().primaryKeys());
  const newResources = RESOURCES.filter((r) => !resourceIds.has(r.id)).map((r) => ({
    id: r.id,
    watched: false,
    updatedAt: now,
  }));
  if (newResources.length > 0) await db.resources.bulkAdd(newResources);

  const total = newCards.length + newQuestions.length + newResources.length;
  if (total > 0) {
    console.log(
      `✅ Synced new content: ${newCards.length} cards, ${newQuestions.length} questions, ${newResources.length} resources`,
    );
  }
}

export async function initializeDb() {
  const existingProfile = await db.profile.get(1);
  if (existingProfile) {
    await syncSeedContent();
    return;
  }

  const now = new Date().toISOString();
  const examDateDefault = new Date();
  examDateDefault.setDate(examDateDefault.getDate() + 56);

  // Create profile
  const profile: Profile = {
    id: 1,
    displayName: "Scholar",
    examDate: examDateDefault.toISOString().split("T")[0],
    dailyGoalMinutes: 120,
    startDate: now,
    xp: 0,
    level: 0,
    streak: 0,
    longestStreak: 0,
    streakFreezesUsedThisWeek: 0,
    streakWeekKey: getWeekKey(new Date()),
    lastActiveDate: null,
    mindsetChoicesCorrect: 0,
    technicianMisses: 0,
    speedReaderMisses: 0,
    createdAt: now,
  };

  await db.profile.add(profile);

  // Seed domains
  await db.domains.bulkAdd(DOMAINS);

  // Seed quests
  const questsWithCompleted: Quest[] = QUEST_SEEDS.map(q => ({
    ...q,
    completedAt: null,
    minutesLogged: 0,
  }));
  await db.quests.bulkAdd(questsWithCompleted);

  // Seed flashcards
  const flashcards = buildFlashcardSeed();
  await db.flashcards.bulkAdd(flashcards);

  // Seed questions
  await db.questions.bulkAdd(ALL_QUESTIONS);

  // Seed resources (watched state)
  const resourceStates = RESOURCES.map(r => ({
    id: r.id,
    watched: false,
    updatedAt: now,
  }));
  await db.resources.bulkAdd(resourceStates);

  console.log("✅ Database initialized");
}
