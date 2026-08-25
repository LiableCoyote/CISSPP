import { create } from "zustand";
import { db, type Profile } from "../db/schema";
import { xpToLevel } from "../lib/xp";
import { useLevelUp } from "./levelUp";
import { checkAchievements } from "../features/achievements/engine";

interface ProfileStore {
  profile: Profile | null;
  loading: boolean;
  initProfile: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
  /**
   * Adds to the stored XP, reading it inside a transaction rather than from a
   * snapshot.
   *
   * Every award used to compute `profile.xp + delta` from whatever the store or
   * a React render last saw, and write that absolute total. `unlock()` in the
   * achievement engine reads the row fresh and adds badge XP, so a badge landing
   * between the read and the write was silently overwritten — and two awards in
   * the same tick lost one of themselves the same way.
   *
   * `delta` may be negative (undoing a quest); the total is clamped at zero.
   */
  addXp: (delta: number, patch?: Partial<Profile>) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

function handleLevelTransition(prev: Profile | null, next: Profile | null) {
  if (!prev || !next) return;
  const prevLevel = xpToLevel(prev.xp).level;
  const nextLevel = xpToLevel(next.xp).level;
  if (nextLevel > prevLevel) {
    useLevelUp.getState().open(nextLevel);
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
  addXp: async (delta, patch) => {
    const prev = get().profile;
    await db.transaction("rw", db.profile, async () => {
      const row = await db.profile.get(1);
      if (!row) return;
      await db.profile.update(1, { ...patch, xp: Math.max(0, row.xp + delta) });
    });
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
