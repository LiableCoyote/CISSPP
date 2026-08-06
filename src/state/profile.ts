import { create } from "zustand";
import { db, type Profile } from "../db/schema";
import { xpToLevel } from "../lib/xp";
import { useLevelUp } from "../components/gamification/LevelUpModal";
import { checkAchievements } from "../features/achievements/engine";

interface ProfileStore {
  profile: Profile | null;
  loading: boolean;
  initProfile: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

function handleLevelTransition(prev: Profile | null, next: Profile | null) {
  if (!prev || !next) return;
  const prevLevel = xpToLevel(prev.xp).level;
  const nextLevel = xpToLevel(next.xp).level;
  if (nextLevel > prevLevel) {
    useLevelUp.getState().open(nextLevel);
    db.profile.update(1, { level: nextLevel }).catch(() => {});
    void checkAchievements({ kind: "level-up", previousLevel: prevLevel, newLevel: nextLevel });
  }
  if (next.streak > prev.streak) {
    void checkAchievements({ kind: "streak", streak: next.streak });
  }
}

export const useProfile = create<ProfileStore>((set, get) => ({
  profile: null,
  loading: true,
  initProfile: async () => {
    // `loading` gates the whole app, so it must be cleared on every path —
    // otherwise a read failure pins the user on the loading screen.
    try {
      const p = await db.profile.get(1);
      set({ profile: p || null });
    } finally {
      set({ loading: false });
    }
  },
  updateProfile: async (updates) => {
    const prev = get().profile;
    await db.profile.update(1, updates);
    const p = (await db.profile.get(1)) || null;
    set({ profile: p });
    handleLevelTransition(prev, p);
  },
  refreshProfile: async () => {
    const prev = get().profile;
    const p = (await db.profile.get(1)) || null;
    set({ profile: p });
    handleLevelTransition(prev, p);
  },
}));
