/**
 * Reference study paces for the 8-week campaign.
 *
 * These are NOT other users. This app is offline and single-user, so there is
 * no population to rank against — inventing peers would put fabricated numbers
 * on screen. Instead each entry is a named pace archetype with a defined weekly
 * rate, so "where am I relative to exam-ready?" has an honest answer. Values
 * scale with how far into the campaign the user is.
 */
export type PaceArchetype = {
  id: string;
  name: string;
  icon: string;
  blurb: string;
  /** XP accumulated per campaign week at this pace. */
  xpPerWeek: number;
  /** Streak days this pace sustains — capped by weeks elapsed. */
  streakPerWeek: number;
  /** Achievements unlocked per week at this pace. */
  achievementsPerWeek: number;
  /** Domains at 70%+ by the end of week N (index 0 = week 1). */
  domainsMasteredByWeek: number[];
};

export const PACE_ARCHETYPES: PaceArchetype[] = [
  {
    id: "exam-ready",
    name: "Exam-Ready Pace",
    icon: "🎓",
    blurb: "Finishes every quest, drills daily, passes the Week 7 boss at 75%+.",
    xpPerWeek: 5200,
    streakPerWeek: 7,
    achievementsPerWeek: 3.4,
    domainsMasteredByWeek: [1, 2, 3, 4, 5, 6, 7, 8],
  },
  {
    id: "steady",
    name: "Steady Sam",
    icon: "🧗",
    blurb: "About 45 focused minutes a day. Never spectacular, never behind.",
    xpPerWeek: 3600,
    streakPerWeek: 6.5,
    achievementsPerWeek: 2.4,
    domainsMasteredByWeek: [0, 1, 2, 3, 4, 5, 6, 7],
  },
  {
    id: "weekend",
    name: "Weekend Warrior",
    icon: "📅",
    blurb: "Two long weekend sessions. Covers ground, but retention leaks midweek.",
    xpPerWeek: 2600,
    streakPerWeek: 2.5,
    achievementsPerWeek: 1.6,
    domainsMasteredByWeek: [0, 0, 1, 2, 3, 3, 4, 5],
  },
  {
    id: "dawn",
    name: "Dawn Patrol",
    icon: "🌅",
    blurb: "Thirty minutes before work, every single day. Streak specialist.",
    xpPerWeek: 3000,
    streakPerWeek: 7,
    achievementsPerWeek: 2.2,
    domainsMasteredByWeek: [0, 1, 2, 2, 3, 4, 5, 6],
  },
  {
    id: "cram",
    name: "Cram Casey",
    icon: "🔥",
    blurb: "Nothing for ten days, then a nine-hour panic. Scores swing wildly.",
    xpPerWeek: 1900,
    streakPerWeek: 1,
    achievementsPerWeek: 1,
    domainsMasteredByWeek: [0, 0, 0, 1, 1, 2, 2, 3],
  },
  {
    id: "dabbler",
    name: "The Dabbler",
    icon: "🌱",
    blurb: "Opens the app, reads a bit, closes it. Good intentions, thin practice.",
    xpPerWeek: 900,
    streakPerWeek: 1.5,
    achievementsPerWeek: 0.6,
    domainsMasteredByWeek: [0, 0, 0, 0, 1, 1, 1, 2],
  },
];

export type PaceMetric = "xp" | "streak" | "domains" | "achievements";

export const PACE_METRICS: { key: PaceMetric; label: string; unit: string }[] = [
  { key: "xp", label: "Total XP", unit: "XP" },
  { key: "streak", label: "Streak", unit: "days" },
  { key: "domains", label: "Domains 70%+", unit: "domains" },
  { key: "achievements", label: "Achievements", unit: "unlocked" },
];

/** What this pace would have reached by the given campaign week (1-8). */
export function paceValueAt(a: PaceArchetype, metric: PaceMetric, week: number): number {
  const w = Math.min(8, Math.max(1, week));
  switch (metric) {
    case "xp":
      return Math.round(a.xpPerWeek * w);
    case "streak":
      // A streak can't exceed the days elapsed in the campaign.
      return Math.min(Math.round(a.streakPerWeek * w), w * 7);
    case "domains":
      return a.domainsMasteredByWeek[w - 1];
    case "achievements":
      return Math.min(29, Math.round(a.achievementsPerWeek * w));
  }
}
