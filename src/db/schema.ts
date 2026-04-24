import Dexie, { type Table } from "dexie";

export type DomainId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export type Priority = "HIGH" | "Medium";

export interface Profile {
  id: 1;
  displayName: string;
  examDate: string | null;
  dailyGoalMinutes: number;
  startDate: string;
  xp: number;
  level: number;
  streak: number;
  longestStreak: number;
  streakFreezesUsedThisWeek: number;
  streakWeekKey: string;
  lastActiveDate: string | null;
  mindsetChoicesCorrect: number;
  technicianMisses: number;
  speedReaderMisses: number;
  createdAt: string;
}

export interface Domain {
  id: DomainId;
  name: string;
  weight: number;
  priority: Priority;
  accent: string;
  mastery: number;
  videosWatched: string[];
  notes: string;
  updatedAt: string;
}

export interface Quest {
  id: string;
  week: number;
  day: number;
  title: string;
  description: string;
  domainIds: DomainId[];
  xp: number;
  type: "read" | "watch" | "quiz" | "flashcards" | "exam" | "rest" | "review";
  completedAt: string | null;
  minutesLogged: number;
}

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  domainId: DomainId | null;
  tags: string[];
  ease: number;
  interval: number;
  reps: number;
  lapses: number;
  dueAt: string;
  lastReviewedAt: string | null;
  createdAt: string;
  source: "seed" | "user" | "quiz-miss";
}

export interface Question {
  id: string;
  domainId: DomainId;
  prompt: string;
  options: [string, string, string, string];
  answerIndex: 0 | 1 | 2 | 3;
  explanation: string;
  tags: string[];
  isMindsetHeavy: boolean;
  technicianTrap?: 0 | 1 | 2 | 3;
}

export interface QuizAttempt {
  id: string;
  mode: "domain" | "mixed" | "full";
  domainId: DomainId | null;
  questionIds: string[];
  startedAt: string;
  finishedAt: string | null;
  totalSeconds: number;
  score: number;
  scorePct: number;
  passed: boolean | null;
  targetScorePct: number | null;
}

export interface QuizAnswer {
  id: string;
  attemptId: string;
  questionId: string;
  pickedIndex: number | null;
  correct: boolean;
  timeTakenMs: number;
  flaggedMindset: boolean;
  flaggedSpeed: boolean;
  missCategory: "mindset" | "knowledge" | "misread" | null;
  // 1 (unsure) – 5 (confident). null means the user skipped the picker.
  confidence: 1 | 2 | 3 | 4 | 5 | null;
}

export interface StudyDay {
  date: string;
  minutes: number;
  sessions: number;
  questsCompleted: number;
  flashcardsReviewed: number;
}

export interface Achievement {
  id: string;
  unlockedAt: string;
}

export interface AppNote {
  id: string;
  domainId: DomainId | null;
  title: string;
  body: string;
  updatedAt: string;
}

export interface ResourceState {
  id: string;
  watched: boolean;
  updatedAt: string;
}

// Resolved once at module load — switching profiles requires a page reload
const _activeSlot = localStorage.getItem("cisspp-active-slot") || "default";

class CissppDb extends Dexie {
  profile!: Table<Profile, 1>;
  domains!: Table<Domain, DomainId>;
  quests!: Table<Quest, string>;
  flashcards!: Table<Flashcard, string>;
  questions!: Table<Question, string>;
  attempts!: Table<QuizAttempt, string>;
  answers!: Table<QuizAnswer, string>;
  studyLog!: Table<StudyDay, string>;
  achievements!: Table<Achievement, string>;
  notes!: Table<AppNote, string>;
  resources!: Table<ResourceState, string>;

  constructor() {
    super("cisspp-" + _activeSlot);
    this.version(1).stores({
      profile: "id",
      domains: "id, priority",
      quests: "id, week, day, completedAt",
      flashcards: "id, domainId, dueAt, source",
      questions: "id, domainId",
      attempts: "id, mode, startedAt, finishedAt",
      answers: "id, attemptId, questionId",
      studyLog: "date",
      achievements: "id, unlockedAt",
      notes: "id, domainId",
      resources: "id",
    });
    // v2: backfill `confidence: null` on existing answers. No index change needed.
    this.version(2)
      .stores({
        answers: "id, attemptId, questionId",
      })
      .upgrade(async (tx) => {
        await tx.table("answers").toCollection().modify((a: QuizAnswer) => {
          if (a.confidence === undefined) a.confidence = null;
        });
      });
  }
}

export const db = new CissppDb();
