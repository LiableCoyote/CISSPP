import { create } from "zustand";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { LEVEL_TITLES } from "../../lib/xp";

interface LevelUpStore {
  newLevel: number | null;
  open: (level: number) => void;
  close: () => void;
}

export const useLevelUp = create<LevelUpStore>((set) => ({
  newLevel: null,
  open: (level) => set({ newLevel: level }),
  close: () => set({ newLevel: null }),
}));

export default function LevelUpModal() {
  const newLevel = useLevelUp((s) => s.newLevel);
  const close = useLevelUp((s) => s.close);

  useEffect(() => {
    if (newLevel === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter") close();
    };
    window.addEventListener("keydown", onKey);
    if ("vibrate" in navigator) navigator.vibrate([20, 40, 30]);
    return () => window.removeEventListener("keydown", onKey);
  }, [newLevel, close]);

  const title = newLevel !== null ? LEVEL_TITLES[Math.min(newLevel, LEVEL_TITLES.length - 1)] : "";

  return (
    <AnimatePresence>
      {newLevel !== null && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="levelup-title"
          className="fixed inset-0 z-[60] bg-bg/90 backdrop-blur flex items-center justify-center p-6"
          onClick={close}
        >
          <motion.div
            initial={{ scale: 0.6, opacity: 0, y: 40 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            onClick={(e) => e.stopPropagation()}
            className="card border-2 border-accent shadow-glow text-center max-w-sm w-full py-10"
          >
            <motion.p
              animate={{ rotate: [0, -6, 6, -4, 4, 0], scale: [1, 1.1, 1] }}
              transition={{ duration: 1.2 }}
              className="text-7xl mb-4"
              aria-hidden="true"
            >
              🎉
            </motion.p>
            <p className="text-xs uppercase tracking-wider text-accent font-semibold">Level Up</p>
            <h2 id="levelup-title" className="text-4xl font-bold mt-2 text-ink">
              Level {newLevel}
            </h2>
            <p className="text-lg mt-2 text-accent">{title}</p>
            <button className="btn-primary mt-8 w-full" onClick={close}>
              Keep Studying →
            </button>
            <p className="text-xs text-dim mt-2">Press Enter or Esc</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
