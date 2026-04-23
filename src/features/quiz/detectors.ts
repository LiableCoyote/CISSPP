// Heuristics to detect failure modes (technician, speed-reader)

export function isSpeedReader(timeTakenMs: number): boolean {
  // Answered in < 10 seconds = possibly didn't read carefully
  return timeTakenMs < 10000;
}

export function isTechnicianAnswer(
  question: { isMindsetHeavy: boolean; technicianTrap?: 0 | 1 | 2 | 3 },
  pickedIndex: number,
): boolean {
  if (!question.isMindsetHeavy) return false;
  if (question.technicianTrap === undefined) return false;
  return pickedIndex === question.technicianTrap;
}

export function getSpeedReaderNudge(): string {
  const nudges = [
    "Speed-reader check: did you notice the BEST, FIRST, or MOST in that question?",
    "Slow down — 90 seconds per Q is the rule, not the race.",
    "Read the full question again. You might have skipped a key word.",
  ];
  return nudges[Math.floor(Math.random() * nudges.length)];
}

export function getTechnicianNudge(): string {
  const nudges = [
    "Technician check: you picked a technical fix. What would a CISO or risk manager choose instead?",
    "Think business-first. The technical answer isn't always the exam answer.",
    "CISSP rewards governance and risk thinking over pure technical knowledge.",
  ];
  return nudges[Math.floor(Math.random() * nudges.length)];
}

export function getDomainHoarderCheck(last7daysByDomain: Record<number, number>): { triggered: boolean; message: string } {
  const total = Object.values(last7daysByDomain).reduce((a, b) => a + b, 0);
  if (total === 0) return { triggered: false, message: "" };

  const maxDomain = Math.max(...Object.values(last7daysByDomain));
  const pct = (maxDomain / total) * 100;

  if (pct > 50) {
    const favDomain = Object.entries(last7daysByDomain).find(([, v]) => v === maxDomain)?.[0] || "1";
    return {
      triggered: true,
      message: `Domain Hoarder Alert: You've spent ${pct.toFixed(0)}% of study time in Domain ${favDomain}. Balance your domains — D1, D3, D4, D5, D7 are high-weight.`,
    };
  }

  return { triggered: false, message: "" };
}
