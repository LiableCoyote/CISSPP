import { create } from "zustand";
import { db, type Profile } from "../db/schema";

interface ProfileStore {
  profile: Profile | null;
  loading: boolean;
  initProfile: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
}

export const useProfile = create<ProfileStore>((set) => ({
  profile: null,
  loading: true,
  initProfile: async () => {
    const p = await db.profile.get(1);
    set({ profile: p || null, loading: false });
  },
  updateProfile: async (updates) => {
    await db.profile.update(1, updates);
    const p = await db.profile.get(1);
    set({ profile: p || null });
  },
}));
