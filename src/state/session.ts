import { create } from "zustand";

export interface QuizSessionState {
  sessionId: string;
  mode: "domain" | "mixed" | "full";
  domainId: number | null;
  questionIds: string[];
  currentIndex: number;
  pickedAnswers: (number | null)[];
  startedAt: Date;
  timeSpentPerQuestion: number[];
  flags: { speed: boolean; technician: boolean }[];
}

interface QuizSessionStore {
  session: QuizSessionState | null;
  startSession: (session: QuizSessionState) => void;
  pickAnswer: (index: number, answer: number) => void;
  nextQuestion: () => void;
  endSession: () => void;
}

export const useQuizSession = create<QuizSessionStore>((set) => ({
  session: null,
  startSession: (session) => set({ session }),
  pickAnswer: (index, answer) =>
    set((state) => {
      if (!state.session) return state;
      const newAnswers = [...state.session.pickedAnswers];
      newAnswers[index] = answer;
      return {
        session: { ...state.session, pickedAnswers: newAnswers },
      };
    }),
  nextQuestion: () =>
    set((state) => {
      if (!state.session) return state;
      return {
        session: {
          ...state.session,
          currentIndex: Math.min(state.session.currentIndex + 1, state.session.questionIds.length - 1),
        },
      };
    }),
  endSession: () => set({ session: null }),
}));
