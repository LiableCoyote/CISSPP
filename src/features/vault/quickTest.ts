import type { OrderGameDef } from "../../data/vault";

export type QuickTestQuestion = {
  id: string;
  prompt: string;
  options: string[];
  answerIndex: number;
  explain: string;
};

export const QUICK_TEST_SECONDS = 30;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const OPTION_COUNT = 4;

/**
 * Wraps `answer` in distractors so every question offers OPTION_COUNT choices.
 *
 * Distractors always come from the full sequence, never a pre-filtered pool —
 * passing a reduced pool used to yield 3 options on "what comes after X" while
 * "what comes first" offered 4, which telegraphs the question type.
 */
function buildOptions(answer: string, order: string[]): { options: string[]; answerIndex: number } {
  const distractors = shuffle(order.filter((x) => x !== answer)).slice(0, OPTION_COUNT - 1);
  const options = shuffle([answer, ...distractors]);
  return { options, answerIndex: options.indexOf(answer) };
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/**
 * Derives recall questions from a sequence's canonical order. Every question is
 * answerable from the ordering alone — no extra content authoring needed, so new
 * order games get a quick-test for free.
 */
export function buildQuickTest(game: OrderGameDef, count = 5): QuickTestQuestion[] {
  const order = game.order;
  const n = order.length;
  if (n < 2) return [];

  const candidates: QuickTestQuestion[] = [];

  candidates.push({
    id: `${game.id}-first`,
    prompt: `In ${game.title}, which comes FIRST?`,
    ...buildOptions(order[0], order),
    explain: `${order[0]} is step 1. ${game.why}`,
  });

  candidates.push({
    id: `${game.id}-last`,
    prompt: `In ${game.title}, which comes LAST?`,
    ...buildOptions(order[n - 1], order),
    explain: `${order[n - 1]} closes the sequence. ${game.why}`,
  });

  for (let i = 0; i < n - 1; i++) {
    candidates.push({
      id: `${game.id}-after-${i}`,
      prompt: `Which comes immediately AFTER "${order[i]}"?`,
      ...buildOptions(order[i + 1], order),
      explain: `${order[i]} (step ${i + 1}) is followed by ${order[i + 1]} (step ${i + 2}).`,
    });
  }

  for (let i = 1; i < n; i++) {
    candidates.push({
      id: `${game.id}-before-${i}`,
      prompt: `Which comes immediately BEFORE "${order[i]}"?`,
      ...buildOptions(order[i - 1], order),
      explain: `${order[i]} (step ${i + 1}) is preceded by ${order[i - 1]} (step ${i}).`,
    });
  }

  // Interior positions only: "which step is 1st" and "which step is last" are
  // the -first and -last questions reworded, with the same answer.
  for (let i = 1; i < n - 1; i++) {
    candidates.push({
      id: `${game.id}-pos-${i}`,
      prompt: `Which step is ${ordinal(i + 1)} in ${game.title}?`,
      ...buildOptions(order[i], order),
      explain: `${order[i]} sits at position ${i + 1} of ${n}.`,
    });
  }

  // A set can hold at most one question per step, since two questions sharing a
  // correct answer read as a repeat however differently they're worded.
  const target = Math.min(count, n);

  const answerOf = (q: QuickTestQuestion) => q.options[q.answerIndex];
  const kindOf = (q: QuickTestQuestion) => q.id.replace(/-\d+$/, "");

  const picked: QuickTestQuestion[] = [];
  const usedAnswers = new Set<string>();
  const usedKinds = new Set<string>();

  // First pass prefers an unseen question type, so a set isn't all "after".
  for (const q of shuffle(candidates)) {
    if (picked.length >= target) break;
    if (usedAnswers.has(answerOf(q))) continue;
    if (usedKinds.has(kindOf(q))) continue;
    usedAnswers.add(answerOf(q));
    usedKinds.add(kindOf(q));
    picked.push(q);
  }
  // Second pass fills the remainder, still refusing a repeated answer.
  for (const q of shuffle(candidates)) {
    if (picked.length >= target) break;
    if (usedAnswers.has(answerOf(q))) continue;
    usedAnswers.add(answerOf(q));
    picked.push(q);
  }

  return picked;
}
