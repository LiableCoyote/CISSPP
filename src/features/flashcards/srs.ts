// SM-2 algorithm: https://en.wikipedia.org/wiki/Spaced_repetition#SM-2

export interface SM2State {
  ease: number;
  interval: number;
  reps: number;
  lapses: number;
}

type Quality = 0 | 1 | 2 | 3 | 4; // 0=complete blackout, 1=incorrect, 2=correct w/ hesitation, 3=correct w/ thinking, 4=perfect

export function sm2(state: SM2State, quality: Quality): SM2State {
  const { ease, interval, reps, lapses } = state;

  const newEase = Math.max(1.3, ease + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));

  if (quality < 3) {
    return {
      ease: newEase,
      interval: 1,
      reps: 0,
      lapses: lapses + 1,
    };
  }

  let newInterval: number;
  if (reps === 0) {
    newInterval = 1;
  } else if (reps === 1) {
    newInterval = 3;
  } else {
    newInterval = Math.round(interval * newEase);
  }

  return {
    ease: newEase,
    interval: newInterval,
    reps: reps + 1,
    lapses,
  };
}

export function nextReviewDate(today: Date, newInterval: number): Date {
  const next = new Date(today);
  next.setDate(next.getDate() + newInterval);
  return next;
}

// UI labels for the SM-2 grading buttons
export const GRADES = [
  { quality: 0 as Quality, label: "❌ Again", color: "text-danger" },
  { quality: 1 as Quality, label: "😞 Hard", color: "text-warn" },
  { quality: 3 as Quality, label: "✅ Good", color: "text-accent" },
  { quality: 4 as Quality, label: "🔥 Perfect", color: "text-high" },
];
