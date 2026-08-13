import { useState, useEffect } from "react";
import { Reorder } from "framer-motion";
import { db } from "../../db/schema";
import { checkAchievements } from "../achievements/engine";
import { reportFailure } from "../../lib/failure";

interface Props {
  /** Stable id of the sequence, used to record wins. */
  gameId: string;
  title: string;
  canonicalOrder: string[];
  hint?: string;
  /** When provided, renders a Quick Test button alongside the check controls. */
  onQuickTest?: () => void;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function OrderGame({ gameId, title, canonicalOrder, hint, onQuickTest }: Props) {
  const [items, setItems] = useState<string[]>(() => shuffle(canonicalOrder));
  const [checked, setChecked] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  const correct = items.every((it, i) => it === canonicalOrder[i]);

  useEffect(() => {
    if (!checked || !correct) return;
    if ("vibrate" in navigator) navigator.vibrate([10, 50, 10, 50, 30]);

    // Record the win so streak-style achievements can count it.
    void (async () => {
      try {
        const existing = await db.vaultWins.get(gameId);
        await db.vaultWins.put({
          gameId,
          wins: (existing?.wins ?? 0) + 1,
          lastWonAt: new Date().toISOString(),
        });
        await checkAchievements({ kind: "vault-order-win", gameId });
      } catch (err) {
        // Silently swallowing this was worse than it looked: `bia-first` unlocks
        // off the vaultWins row, so a failed write here made that achievement
        // permanently unreachable with nothing to explain why.
        reportFailure(
          "record that win",
          err,
          "The sequence was right, but the win wasn't saved — so it won't count toward the vault achievements.",
        );
      }
    })();
  }, [checked, correct, gameId]);

  const moveItem = (idx: number, direction: -1 | 1) => {
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= items.length) return;
    const next = [...items];
    [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
    setItems(next);
    setAnnouncement(`${items[idx]} moved ${direction === -1 ? "up" : "down"} to position ${newIdx + 1}.`);
  };

  const retry = () => {
    setItems(shuffle(canonicalOrder));
    setChecked(false);
    setAnnouncement("Items reshuffled.");
  };

  return (
    <section aria-labelledby={`game-${title.replace(/\s/g, "-")}`} className="card">
      <h3 id={`game-${title.replace(/\s/g, "-")}`} className="font-semibold mb-1">{title}</h3>
      {hint && <p className="text-xs text-dim mb-3">{hint}</p>}
      <p className="text-xs text-dim mb-3">
        <span aria-hidden="true">🎹 </span>
        Keyboard: focus an item, then Alt+↑ / Alt+↓ to move. Enter to check.
      </p>

      {/* Live region for move announcements */}
      <div role="status" aria-live="polite" className="sr-only">{announcement}</div>

      <Reorder.Group axis="y" values={items} onReorder={setItems} className="space-y-2" as="ol">
        {items.map((item, i) => {
          const isCorrectSpot = checked && item === canonicalOrder[i];
          const isWrongSpot = checked && item !== canonicalOrder[i];
          const status = checked ? (isCorrectSpot ? " — correct position" : " — wrong position") : "";
          return (
            <Reorder.Item
              key={item}
              value={item}
              as="li"
              tabIndex={0}
              role="listitem"
              aria-label={`Position ${i + 1} of ${items.length}: ${item}${status}. Use Alt plus Up or Down arrow to reorder.`}
              onKeyDown={(e: React.KeyboardEvent) => {
                if (e.altKey && e.key === "ArrowUp") {
                  e.preventDefault();
                  moveItem(i, -1);
                } else if (e.altKey && e.key === "ArrowDown") {
                  e.preventDefault();
                  moveItem(i, 1);
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  setChecked(true);
                }
              }}
              className={`list-row cursor-grab active:cursor-grabbing select-none focus-visible:ring-2 focus-visible:ring-accent ${
                isCorrectSpot ? "!border-high !bg-high/10" : isWrongSpot ? "!border-danger !bg-danger/10" : ""
              }`}
            >
              <span className="text-dim text-xs w-6" aria-hidden="true">{i + 1}.</span>
              <span className="flex-1 font-medium">{item}</span>
              <span className="text-dim text-lg" aria-hidden="true">⋮⋮</span>
            </Reorder.Item>
          );
        })}
      </Reorder.Group>

      <div className="flex gap-2 mt-4">
        {!checked ? (
          <button onClick={() => setChecked(true)} className="btn-primary flex-1">
            Check
          </button>
        ) : correct ? (
          <>
            <button onClick={retry} className="btn-ghost flex-1">Reshuffle</button>
            <div className="btn-primary flex-1 !bg-high !text-bg cursor-default" role="status" aria-live="polite">
              <span aria-hidden="true">🎉 </span>Correct!
            </div>
          </>
        ) : (
          <>
            <button onClick={retry} className="btn-ghost flex-1">Reshuffle</button>
            <button onClick={() => setChecked(false)} className="btn-outline flex-1">Try Again</button>
          </>
        )}
      </div>

      {onQuickTest && (
        <button onClick={onQuickTest} className="btn-outline w-full mt-2">
          <span aria-hidden="true">⚡ </span>Quick Test — 5 recall questions
        </button>
      )}
    </section>
  );
}
