export const LEVEL_TITLES = [
  "Apprentice Analyst",
  "Associate Security Engineer",
  "Senior Analyst",
  "Manager",
  "Director",
  "VP of Security",
  "CISO-in-Training",
  "Chief Security Officer",
  "Global CISO",
  "Security Legend",
] as const;

export const LEVEL_XP_THRESHOLDS = [
  0, 500, 1500, 3500, 7000, 12000, 18000, 25000, 33000, 42000,
];

export function xpToLevel(xp: number): { level: number; levelTitle: string; xpInLevel: number; xpToNextLevel: number } {
  let level = 0;
  for (let i = 1; i < LEVEL_XP_THRESHOLDS.length; i++) {
    if (xp >= LEVEL_XP_THRESHOLDS[i]) {
      level = i;
    } else {
      break;
    }
  }

  const levelTitle = LEVEL_TITLES[Math.min(level, LEVEL_TITLES.length - 1)];
  const xpInLevel = xp - LEVEL_XP_THRESHOLDS[level];
  const xpToNextLevel = level < LEVEL_XP_THRESHOLDS.length - 1 ? LEVEL_XP_THRESHOLDS[level + 1] - xp : 0;

  return { level, levelTitle, xpInLevel, xpToNextLevel };
}

export function levelToXp(level: number): number {
  return LEVEL_XP_THRESHOLDS[Math.min(level, LEVEL_XP_THRESHOLDS.length - 1)];
}
