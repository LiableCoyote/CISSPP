import { create } from "zustand";

interface LevelUpStore {
  newLevel: number | null;
  open: (level: number) => void;
  close: () => void;
}

/**
 * Lives here rather than beside the modal component so the component file only
 * exports a component — a file that exports both breaks Fast Refresh. Mirrors
 * the split between src/state/toast.ts and src/components/Toast.tsx.
 */
export const useLevelUp = create<LevelUpStore>((set) => ({
  newLevel: null,
  open: (level) => set({ newLevel: level }),
  close: () => set({ newLevel: null }),
}));
