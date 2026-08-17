import { db } from "./schema";
import { getWeekKey } from "../lib/streak";
import { getItem, setItem } from "../lib/safeStorage";
import { getActiveSlotId } from "../lib/profiles";
import type { Profile, Quest } from "./schema";

/**
 * Bump whenever the shipped seed content changes — new cards, quests, questions
 * or resources. It is what lets a returning user skip the backfill entirely.
 * Forgetting to bump it means new content does not reach existing users, which
 * is exactly the failure the quest backfill was added to fix, so treat it as
 * part of adding content rather than as an optimisation knob.
 */
export const CONTENT_VERSION = 3;

/**
 * Per-slot, not global. Each profile slot is a separate IndexedDB database, so
 * a shared key would let slot A's sync mark the content applied for slot B,
 * which was seeded at an older version and would then never receive it.
 */
const appliedVersionKey = () => `cisspp-content-version-${getActiveSlotId()}`;

/**
 * Loaded on demand rather than imported at the top of the module.
 *
 * This file is reachable from App.tsx, so a static import put the entire
 * question bank, flashcard deck and resource list into the entry chunk — a
 * couple of hundred KB parsed before the first paint, on every launch, to
 * support a backfill that usually has nothing to do.
 */
async function loadSeedData() {
  const [{ DOMAINS }, { QUEST_SEEDS }, { buildFlashcardSeed }, { ALL_QUESTIONS }, { RESOURCES }] =
    await Promise.all([
      import("../data/domains"),
      import("../data/weeks"),
      import("../data/flashcards.seed"),
      import("../data/questions.seed"),
      import("../data/resources"),
    ]);
  return { DOMAINS, QUEST_SEEDS, buildFlashcardSeed, ALL_QUESTIONS, RESOURCES };
}

/**
 * Adds content shipped after the user's DB was first seeded. Only inserts rows
 * whose id is missing, so existing SRS progress, quiz history and watched flags
 * are never touched.
 *
 * Exported for tests: that idempotency claim is the whole contract, and it was
 * previously unreachable from outside initializeDb. Deliberately does no
 * version gating of its own — calling it always performs the id diff, so the
 * contract the tests assert is the one callers get.
 */
export async function syncSeedContent() {
  const now = new Date().toISOString();
  const { QUEST_SEEDS, buildFlashcardSeed, ALL_QUESTIONS, RESOURCES } = await loadSeedData();

  const cardIds = new Set(await db.flashcards.toCollection().primaryKeys());
  const newCards = buildFlashcardSeed().filter((c) => !cardIds.has(c.id));
  if (newCards.length > 0) await db.flashcards.bulkAdd(newCards);

  // Quests too. Without this, a quest added in a later release never reached
  // existing users — and checkWeekClear counts whatever is in the database, so
  // two people on the same build needed different quest counts to earn the same
  // week-clear badge.
  const questIds = new Set(await db.quests.toCollection().primaryKeys());
  const newQuests: Quest[] = QUEST_SEEDS.filter((q) => !questIds.has(q.id)).map((q) => ({
    ...q,
    completedAt: null,
    minutesLogged: 0,
  }));
  if (newQuests.length > 0) await db.quests.bulkAdd(newQuests);

  const questionIds = new Set(await db.questions.toCollection().primaryKeys());
  const newQuestions = ALL_QUESTIONS.filter((q) => !questionIds.has(q.id));
  if (newQuestions.length > 0) await db.questions.bulkAdd(newQuestions);

  // Corrections, not just additions.
  //
  // This sync was add-only, keyed on the id being missing. A question whose
  // wording or answer was fixed keeps its id, so the fix reached new installs
  // and nobody else — every existing user kept the wrong version forever. A
  // content audit that cannot ship its own corrections is decoration.
  //
  // Questions are safe to overwrite outright: the row holds no user state.
  // Answers reference questionId from their own table and questionReviews keys
  // by questionId, so neither is touched by replacing the text.
  const corrected = ALL_QUESTIONS.filter((q) => questionIds.has(q.id));
  if (corrected.length > 0) await db.questions.bulkPut(corrected);

  // Cards and quests are different: their rows mix authored content with user
  // progress, so only the authored fields may be refreshed.
  const seedCards = new Map(buildFlashcardSeed().map((c) => [c.id, c]));
  await db.flashcards
    .where("source")
    .equals("seed")
    .modify((card) => {
      const fresh = seedCards.get(card.id);
      if (!fresh) return;
      // Scheduling — ease, interval, reps, lapses, dueAt, lastReviewedAt — is
      // deliberately absent here. Refreshing it would reset the deck.
      card.front = fresh.front;
      card.back = fresh.back;
      card.domainId = fresh.domainId;
      card.tags = fresh.tags;
    });

  const seedQuests = new Map(QUEST_SEEDS.map((q) => [q.id, q]));
  await db.quests.toCollection().modify((quest) => {
    const fresh = seedQuests.get(quest.id);
    if (!fresh) return;
    // completedAt and minutesLogged are the user's, and stay theirs.
    quest.title = fresh.title;
    quest.description = fresh.description;
    quest.domainIds = fresh.domainIds;
    quest.xp = fresh.xp;
    quest.type = fresh.type;
    quest.week = fresh.week;
    quest.day = fresh.day;
  });

  const resourceIds = new Set(await db.resources.toCollection().primaryKeys());
  const newResources = RESOURCES.filter((r) => !resourceIds.has(r.id)).map((r) => ({
    id: r.id,
    watched: false,
    updatedAt: now,
  }));
  if (newResources.length > 0) await db.resources.bulkAdd(newResources);

  const total =
    newCards.length + newQuests.length + newQuestions.length + newResources.length + corrected.length;
  if (total > 0 && import.meta.env.DEV) {
    console.log(
      `✅ Synced content: +${newCards.length} cards, +${newQuests.length} quests, +${newQuestions.length} questions, +${newResources.length} resources, ${corrected.length} questions refreshed`,
    );
  }
}

export async function initializeDb() {
  const existingProfile = await db.profile.get(1);
  if (existingProfile) {
    // The common case: a returning user on the build they last ran. There is by
    // definition nothing to backfill, so return before loadSeedData() is ever
    // called and the seed chunk stays unfetched.
    //
    // If storage is blocked, getItem returns null and the sync runs — the guard
    // degrades to the old, slower, always-correct behaviour rather than to
    // silently skipping content.
    if (getItem(appliedVersionKey()) === String(CONTENT_VERSION)) return;
    await syncSeedContent();
    // Only after a successful sync: a throw above must leave the version unset
    // so the next launch tries again.
    setItem(appliedVersionKey(), String(CONTENT_VERSION));
    return;
  }

  const { DOMAINS, QUEST_SEEDS, buildFlashcardSeed, ALL_QUESTIONS, RESOURCES } = await loadSeedData();
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

  setItem(appliedVersionKey(), String(CONTENT_VERSION));

  if (import.meta.env.DEV) console.log("✅ Database initialized");
}
