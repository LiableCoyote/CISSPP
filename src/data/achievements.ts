import type { Achievement } from "../db/schema";

export type AchievementDef = {
  id: string;
  name: string;
  description: string;
  icon: string;
  xp: number;
};

export const ACHIEVEMENT_DEFS: AchievementDef[] = [
  { id: "first-blood", name: "First Blood", description: "Complete your first quiz.", icon: "🎯", xp: 50 },
  { id: "day-1-quests", name: "Day One Warrior", description: "Complete all Day 1 quests.", icon: "⚔️", xp: 75 },
  { id: "streak-7", name: "No Skip Zone", description: "7-day study streak.", icon: "🔥", xp: 100 },
  { id: "streak-14", name: "Two-Week Sprint", description: "14-day study streak.", icon: "🔥🔥", xp: 200 },
  { id: "streak-28", name: "Iron Discipline", description: "28-day study streak.", icon: "💎", xp: 400 },
  { id: "week-1-clear", name: "Foundation Laid", description: "All Week 1 quests complete.", icon: "🏗️", xp: 150 },
  { id: "week-2-clear", name: "Architect", description: "All Week 2 quests complete.", icon: "🔐", xp: 150 },
  { id: "week-3-clear", name: "Sprint Complete", description: "All Week 3 quests complete.", icon: "💨", xp: 150 },
  { id: "week-4-clear", name: "First Gap Analysis", description: "All Week 4 quests complete.", icon: "📊", xp: 200 },
  { id: "week-5-clear", name: "Cross-Domain Thinker", description: "All Week 5 quests complete.", icon: "🕸️", xp: 200 },
  { id: "week-6-clear", name: "Surgical Precision", description: "All Week 6 quests complete.", icon: "🔬", xp: 200 },
  { id: "week-7-clear", name: "Endurance Proven", description: "All Week 7 quests complete.", icon: "🏋️", xp: 200 },
  { id: "week-8-clear", name: "Exam Ready", description: "All Week 8 quests complete.", icon: "🎓", xp: 300 },
  { id: "boss-1-pass", name: "Boss Slayer I", description: "Pass the Week 4 full-length exam.", icon: "🐉", xp: 300 },
  { id: "boss-2-pass", name: "Boss Slayer II", description: "Score 70%+ on the Week 6 full-length exam.", icon: "🐲", xp: 400 },
  { id: "boss-3-pass", name: "Boss Slayer III", description: "Score 75%+ on the Week 7 full-length exam.", icon: "🏆", xp: 500 },
  { id: "flashcard-100", name: "Card Carrier", description: "Review 100 flashcards in one session.", icon: "📇", xp: 75 },
  { id: "flashcard-500", name: "Flashcard Savant", description: "Review 500 flashcards total.", icon: "🃏", xp: 150 },
  { id: "bia-first", name: "BIA First", description: "Correctly order BCP steps 5 times.", icon: "📋", xp: 75 },
  { id: "think-like-ciso", name: "Think Like a CISO", description: "Choose management over technical on 25 questions.", icon: "🎩", xp: 200 },
  { id: "no-technician", name: "No Technician", description: "<10% mindset misses over a 50-question set.", icon: "🧠", xp: 150 },
  { id: "domain-master-any", name: "Domain Domination", description: "Score 85%+ on any single domain quiz.", icon: "⭐", xp: 100 },
  { id: "domain-master-d3", name: "Crypto Conqueror", description: "Score 80%+ on Domain 3 questions.", icon: "🔑", xp: 150 },
  { id: "gap-closer", name: "Gap Closer", description: "Raise a weak domain from <60% to 70%+.", icon: "📈", xp: 200 },
  { id: "full-deck-review", name: "Full Sweep", description: "Review every card in the flashcard deck in one day.", icon: "🌊", xp: 100 },
  { id: "vault-quiz-perfect", name: "Vault Master", description: "Perfect score on any Vault quick-test.", icon: "🏛️", xp: 100 },
  { id: "level-5", name: "Director", description: "Reach Level 5.", icon: "🎖️", xp: 0 },
  { id: "level-7", name: "CISO Candidate", description: "Reach Level 7.", icon: "🌟", xp: 0 },
  { id: "level-10", name: "Chief Security Officer", description: "Reach Level 10.", icon: "👑", xp: 0 },
];

export type { Achievement };
