import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

type Shortcut = { keys: string; description: string };

const GLOBAL: Shortcut[] = [
  { keys: "?", description: "Open this keyboard help" },
  { keys: "⌘K / Ctrl+K", description: "Open search" },
  { keys: "Esc", description: "Close any open modal" },
];

const FLASHCARDS: Shortcut[] = [
  { keys: "Space / Enter", description: "Reveal the card" },
  { keys: "1", description: "Grade: Again" },
  { keys: "2", description: "Grade: Hard" },
  { keys: "3", description: "Grade: Good" },
  { keys: "4", description: "Grade: Perfect" },
  { keys: "Swipe ← / →", description: "Again / Good" },
  { keys: "Swipe ↑ / ↓", description: "Perfect / Hard" },
];

const QUIZ: Shortcut[] = [
  { keys: "1–4", description: "Pick answer option" },
];

const VAULT: Shortcut[] = [
  { keys: "Alt + ↑ / ↓", description: "Reorder rows in drag-to-order tables" },
];

function Section({ title, items }: { title: string; items: Shortcut[] }) {
  return (
    <section className="mb-4 last:mb-0">
      <h3 className="text-xs uppercase tracking-wider text-dim font-semibold mb-2">{title}</h3>
      <dl className="space-y-1">
        {items.map((s) => (
          <div key={s.keys} className="flex items-center justify-between text-sm gap-3">
            <dt className="font-mono text-xs px-2 py-0.5 rounded bg-panel2 border border-border text-ink shrink-0">
              {s.keys}
            </dt>
            <dd className="text-dim text-right flex-1 min-w-0">{s.description}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export default function KeyboardHelp() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Ignore when typing into inputs, textareas, or contenteditable regions.
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.key === "?" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="kbd-help-title"
          className="fixed inset-0 z-[55] bg-bg/80 backdrop-blur flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <motion.div
            initial={{ scale: 0.96, y: 10, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="card max-w-md w-full max-h-[80vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-3">
              <h2 id="kbd-help-title" className="font-semibold">
                Keyboard shortcuts
              </h2>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close keyboard help"
                className="text-dim hover:text-ink text-xl leading-none"
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>
            <Section title="Global" items={GLOBAL} />
            <Section title="Flashcards" items={FLASHCARDS} />
            <Section title="Quiz" items={QUIZ} />
            <Section title="Vault" items={VAULT} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
