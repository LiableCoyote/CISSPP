import { format } from "date-fns";
import type { Profile, Quest, QuizAttempt } from "../db/schema";
import { DOMAINS } from "../data/domains";
import type { DomainVelocity } from "./analytics";

export type Recommendation = {
  id: string;
  icon: string;
  title: string;
  body: string;
  to: string;
  actionLabel: string;
  /** Higher wins. Only the top few are shown. */
  priority: number;
};

export type RecommendationInput = {
  profile: Profile;
  attempts: QuizAttempt[];
  quests: Quest[];
  velocity: DomainVelocity[];
  dueCards: number;
  overdueCards: number;
  currentWeek: number;
  currentDay: number;
};

/**
 * Picks what the user should do next, based on yesterday's behaviour rather than
 * a fixed schedule. Returns a ranked list; the Dashboard renders the top entries.
 */
export function buildRecommendations(input: RecommendationInput): Recommendation[] {
  const { profile, attempts, quests, velocity, dueCards, overdueCards, currentWeek, currentDay } =
    input;

  const recs: Recommendation[] = [];
  const todayKey = format(new Date(), "yyyy-MM-dd");
  const studiedToday = profile.lastActiveDate === todayKey;
  const finished = attempts.filter((a) => a.finishedAt);

  // Today's quests are the plan — they outrank everything else.
  const todaysQuests = quests.filter((q) => q.week === currentWeek && q.day === currentDay);
  const openQuests = todaysQuests.filter((q) => !q.completedAt);
  if (openQuests.length > 0) {
    recs.push({
      id: "todays-quests",
      icon: "🗓",
      title: `${openQuests.length} quest${openQuests.length === 1 ? "" : "s"} left today`,
      body: `Week ${currentWeek}, Day ${currentDay}. Staying on the campaign beats improvising.`,
      to: `/plan/week/${currentWeek}`,
      actionLabel: "Open today's plan",
      priority: 100,
    });
  }

  // Weakest domain that has enough attempts to trust the number.
  const weak = velocity
    .filter((v) => v.attempts >= 2 && v.current < 60)
    .sort((a, b) => a.current - b.current)[0];
  if (weak) {
    recs.push({
      id: `weak-domain-${weak.id}`,
      icon: "🎯",
      title: `D${weak.id} is at ${weak.current}%`,
      body: `${weak.name} is your weakest scored domain. A focused drill moves the needle faster than a mixed quiz.`,
      to: `/quiz/session?mode=domain&domain=${weak.id}`,
      actionLabel: "Drill this domain",
      priority: 92,
    });
  }

  // A stagnant domain means more of the same isn't working — switch modality.
  const stagnant = velocity.filter((v) => v.stagnant).sort((a, b) => a.current - b.current)[0];
  if (stagnant && stagnant.id !== weak?.id) {
    recs.push({
      id: `stagnant-${stagnant.id}`,
      icon: "🔁",
      title: `D${stagnant.id} has stalled at ${stagnant.current}%`,
      body: "You've drilled it recently with no movement. Read the Vault tables and flashcards for this domain, then retest.",
      to: `/domains/${stagnant.id}`,
      actionLabel: "Review the material",
      priority: 88,
    });
  }

  if (overdueCards >= 15) {
    recs.push({
      id: "overdue-cards",
      icon: "🗂️",
      title: `${overdueCards} cards overdue`,
      body: "Overdue cards are the ones you're closest to forgetting. Clearing them is the highest-value 10 minutes available.",
      to: "/flashcards/review",
      actionLabel: "Clear the backlog",
      priority: 86,
    });
  }

  if (!studiedToday && profile.streak > 0) {
    recs.push({
      id: "keep-streak",
      icon: "🔥",
      title: `Protect your ${profile.streak}-day streak`,
      body: "Nothing logged today yet. A single quiz or review session counts.",
      to: "/quiz",
      actionLabel: "Log a session",
      priority: 84,
    });
  }

  if (dueCards > 0 && overdueCards < 15) {
    recs.push({
      id: "due-cards",
      icon: "🃏",
      title: `${dueCards} card${dueCards === 1 ? "" : "s"} due`,
      body: "Right on schedule. Reviewing on the due date is what makes the intervals stretch.",
      to: "/flashcards/review",
      actionLabel: "Review now",
      priority: 70,
    });
  }

  // Full-length practice is the only thing that builds exam endurance.
  const fullExams = finished.filter((a) => a.mode === "full").length;
  if (currentWeek >= 4 && fullExams === 0) {
    recs.push({
      id: "first-boss",
      icon: "🐉",
      title: "You haven't taken a full-length exam",
      body: "Week 4 is the checkpoint. 150 questions in one sitting tests stamina, not just knowledge.",
      to: "/quiz",
      actionLabel: "Start the boss exam",
      priority: 78,
    });
  }

  // Mindset is the thing this exam actually punishes.
  if (profile.technicianMisses >= 10 && profile.technicianMisses > profile.mindsetChoicesCorrect) {
    recs.push({
      id: "mindset-drill",
      icon: "🎩",
      title: "The technician trap is costing you",
      body: `${profile.technicianMisses} misses where the technical answer beat the governance one. Run a mixed set and read every stem for BEST/FIRST/MOST.`,
      to: "/quiz/session?mode=mixed",
      actionLabel: "Mixed quiz",
      priority: 76,
    });
  }

  // Untouched domains — coverage gaps hide until exam day. A full-length exam
  // covers every domain but stores domainId: null, so checking domainId alone
  // told users who had sat three full exams that they'd never tested anything.
  const tookFullExam = finished.some((a) => a.mode === "full");
  const untouched = tookFullExam
    ? []
    : DOMAINS.filter((d) => !finished.some((a) => a.domainId === d.id));
  if (untouched.length > 0 && finished.length >= 3) {
    const next = untouched[0];
    recs.push({
      id: `untouched-${next.id}`,
      icon: "🧭",
      title: `You've never tested D${next.id}`,
      body: `${next.name} is ${next.weight}% of the exam and has no attempts yet. Find out where you stand.`,
      to: `/quiz/session?mode=domain&domain=${next.id}`,
      actionLabel: "Take a baseline",
      priority: 74,
    });
  }

  // Always leave something actionable on screen.
  recs.push({
    id: "default-mixed",
    icon: "⚡",
    title: "Keep momentum",
    body: "A 10-question mixed set across all domains is the cheapest way to keep recall warm.",
    to: "/quiz/session?mode=mixed",
    actionLabel: "Mixed quiz",
    priority: 10,
  });

  return recs.sort((a, b) => b.priority - a.priority);
}
