import { db } from "./schema";
import { DOMAINS } from "../data/domains";
import { QUEST_SEEDS } from "../data/weeks";
import { buildFlashcardSeed } from "../data/flashcards.seed";
import { ALL_QUESTIONS } from "../data/questions.seed";
import { RESOURCES } from "../data/resources";
import type { Profile, Quest } from "./schema";

export async function initializeDb() {
  const existingProfile = await db.profile.get(1);
  if (existingProfile) {
    return; // Already seeded
  }

  const now = new Date().toISOString();
  const sevenWeeksLater = new Date();
  sevenWeeksLater.setDate(sevenWeeksLater.getDate() + 56);

  // Create profile
  const profile: Profile = {
    id: 1,
    displayName: "Scholar",
    examDate: sevenWeeksLater.toISOString().split("T")[0],
    dailyGoalMinutes: 120,
    startDate: now,
    xp: 0,
    level: 0,
    streak: 0,
    longestStreak: 0,
    streakFreezesUsedThisWeek: 0,
    streakWeekKey: new Date().getFullYear() + "-W" + Math.ceil(new Date().getDate() / 7).toString().padStart(2, "0"),
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

  // Seed achievements (empty state; unlock as earned)
  await db.achievements.bulkAdd([]);

  // Seed resources (watched state)
  const resourceStates = RESOURCES.map(r => ({
    id: r.id,
    watched: false,
    updatedAt: now,
  }));
  await db.resources.bulkAdd(resourceStates);

  console.log("✅ Database initialized");
}
