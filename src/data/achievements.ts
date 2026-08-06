import type { Achievement } from "../db/schema";

export type AchievementCategory =
  | "Milestones"
  | "Consistency"
  | "Campaign"
  | "Boss Fights"
  | "Flashcards"
  | "Mindset"
  | "Mastery"
  | "Progression";

export const ACHIEVEMENT_CATEGORIES: AchievementCategory[] = [
  "Milestones",
  "Consistency",
  "Campaign",
  "Boss Fights",
  "Flashcards",
  "Mindset",
  "Mastery",
  "Progression",
];

export type AchievementDef = {
  id: string;
  name: string;
  description: string;
  icon: string;
  xp: number;
  category: AchievementCategory;
  /** How to earn it, in plain language. Shown on locked cards as a nudge. */
  hint: string;
};

export const ACHIEVEMENT_DEFS: AchievementDef[] = [
  { id: "first-blood", name: "First Blood", description: "Complete your first quiz.", icon: "🎯", xp: 50, category: "Milestones", hint: "Run any quiz from the Quiz page." },
  { id: "day-1-quests", name: "Day One Warrior", description: "Complete all Day 1 quests.", icon: "⚔️", xp: 75, category: "Milestones", hint: "Clear every quest on Week 1, Day 1." },
  { id: "bia-first", name: "BIA First", description: "Correctly order BCP steps 5 times.", icon: "📋", xp: 75, category: "Milestones", hint: "Nail the BCP order mini-game in the Vault five times." },
  { id: "vault-quiz-perfect", name: "Vault Master", description: "Perfect score on any Vault quick-test.", icon: "🏛️", xp: 100, category: "Milestones", hint: "Score 100% on a Vault quick-test." },
  { id: "streak-7", name: "No Skip Zone", description: "7-day study streak.", icon: "🔥", xp: 100, category: "Consistency", hint: "Study 7 days in a row." },
  { id: "streak-14", name: "Two-Week Sprint", description: "14-day study streak.", icon: "🔥🔥", xp: 200, category: "Consistency", hint: "Study 14 days in a row." },
  { id: "streak-28", name: "Iron Discipline", description: "28-day study streak.", icon: "💎", xp: 400, category: "Consistency", hint: "Study 28 days in a row." },
  { id: "week-1-clear", name: "Foundation Laid", description: "All Week 1 quests complete.", icon: "🏗️", xp: 150, category: "Campaign", hint: "Finish every quest in Week 1." },
  { id: "week-2-clear", name: "Architect", description: "All Week 2 quests complete.", icon: "🔐", xp: 150, category: "Campaign", hint: "Finish every quest in Week 2." },
  { id: "week-3-clear", name: "Sprint Complete", description: "All Week 3 quests complete.", icon: "💨", xp: 150, category: "Campaign", hint: "Finish every quest in Week 3." },
  { id: "week-4-clear", name: "First Gap Analysis", description: "All Week 4 quests complete.", icon: "📊", xp: 200, category: "Campaign", hint: "Finish every quest in Week 4." },
  { id: "week-5-clear", name: "Cross-Domain Thinker", description: "All Week 5 quests complete.", icon: "🕸️", xp: 200, category: "Campaign", hint: "Finish every quest in Week 5." },
  { id: "week-6-clear", name: "Surgical Precision", description: "All Week 6 quests complete.", icon: "🔬", xp: 200, category: "Campaign", hint: "Finish every quest in Week 6." },
  { id: "week-7-clear", name: "Endurance Proven", description: "All Week 7 quests complete.", icon: "🏋️", xp: 200, category: "Campaign", hint: "Finish every quest in Week 7." },
  { id: "week-8-clear", name: "Exam Ready", description: "All Week 8 quests complete.", icon: "🎓", xp: 300, category: "Campaign", hint: "Finish every quest in Week 8." },
  { id: "boss-1-pass", name: "Boss Slayer I", description: "Pass the Week 4 full-length exam.", icon: "🐉", xp: 300, category: "Boss Fights", hint: "Complete the Week 4 full-length exam." },
  { id: "boss-2-pass", name: "Boss Slayer II", description: "Score 70%+ on the Week 6 full-length exam.", icon: "🐲", xp: 400, category: "Boss Fights", hint: "Score 70% or higher on a full-length exam." },
  { id: "boss-3-pass", name: "Boss Slayer III", description: "Score 75%+ on the Week 7 full-length exam.", icon: "🏆", xp: 500, category: "Boss Fights", hint: "Score 75% or higher on a full-length exam." },
  { id: "flashcard-100", name: "Card Carrier", description: "Review 100 flashcards in one session.", icon: "📇", xp: 75, category: "Flashcards", hint: "Review 100 cards in a single day." },
  { id: "flashcard-500", name: "Flashcard Savant", description: "Review 500 flashcards total.", icon: "🃏", xp: 150, category: "Flashcards", hint: "Reach 500 lifetime card reviews." },
  { id: "full-deck-review", name: "Full Sweep", description: "Review every card in the flashcard deck in one day.", icon: "🌊", xp: 100, category: "Flashcards", hint: "Clear the entire deck in one day." },
  { id: "think-like-ciso", name: "Think Like a CISO", description: "Choose management over technical on 25 questions.", icon: "🎩", xp: 200, category: "Mindset", hint: "Pick the governance answer on 25 mindset questions." },
  { id: "no-technician", name: "No Technician", description: "<10% mindset misses over a 50-question set.", icon: "🧠", xp: 150, category: "Mindset", hint: "Keep mindset misses under 10% on a 50+ question quiz." },
  { id: "domain-master-any", name: "Domain Domination", description: "Score 85%+ on any single domain quiz.", icon: "⭐", xp: 100, category: "Mastery", hint: "Score 85% or higher on a domain drill." },
  { id: "domain-master-d3", name: "Crypto Conqueror", description: "Score 80%+ on Domain 3 questions.", icon: "🔑", xp: 150, category: "Mastery", hint: "Score 80% or higher on a Domain 3 drill." },
  { id: "gap-closer", name: "Gap Closer", description: "Raise a weak domain from <60% to 70%+.", icon: "📈", xp: 200, category: "Mastery", hint: "Pull a sub-60% domain back above 70%." },
  { id: "level-5", name: "Director", description: "Reach Level 5.", icon: "🎖️", xp: 0, category: "Progression", hint: "Earn enough XP to hit Level 5." },
  { id: "level-7", name: "CISO Candidate", description: "Reach Level 7.", icon: "🌟", xp: 0, category: "Progression", hint: "Earn enough XP to hit Level 7." },
  { id: "level-10", name: "Chief Security Officer", description: "Reach Level 10.", icon: "👑", xp: 0, category: "Progression", hint: "Earn enough XP to hit Level 10." },
];

export type { Achievement };
