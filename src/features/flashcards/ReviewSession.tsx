import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { motion, useMotionValue, useTransform, type PanInfo } from "framer-motion";
import { db, type Flashcard } from "../../db/schema";
import { sm2, nextReviewDate } from "./srs";
import { useProfile } from "../../state/profile";
import { format } from "date-fns";
import { checkAchievements } from "../achievements/engine";
import { logStudySession } from "../../lib/session";
import { flashcardXp } from "../../lib/rewards";

type Quality = 0 | 1 | 3 | 4;

export default function ReviewSession() {
  const navigate = useNavigate();
  const { profile, addXp, refreshProfile } = useProfile();
  // Frozen at session start. Recomputing `new Date()` each render would let a
  // card that falls due mid-session appear unexpectedly.
  const [sessionStart] = useState(() => new Date().toISOString());
  const dueCards = useLiveQuery(
    () => db.flashcards.where("dueAt").below(sessionStart).toArray(),
    [sessionStart],
  );
  const [revealed, setRevealed] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-12, 12]);
  const opacity = useTransform(
    [x, y],
    ([xv, yv]: number[]) => 1 - Math.min(1, (Math.abs(xv) + Math.abs(yv)) / 400)
  );

  useEffect(() => {
    // Keyboard shortcuts
    const handler = (e: KeyboardEvent) => {
      if (!revealed) {
        if (e.code === "Space" || e.code === "Enter") {
          e.preventDefault();
          setRevealed(true);
        }
        return;
      }
      if (e.key === "1") grade(0);
      if (e.key === "2") grade(1);
      if (e.key === "3") grade(3);
      if (e.key === "4") grade(4);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  if (!dueCards) {
    return <div className="page text-center text-dim">Loading cards…</div>;
  }

  if (dueCards.length === 0) {
    return (
      <div className="page text-center">
        <div className="card">
          <p className="text-5xl mb-3">🎉</p>
          <h2 className="text-xl font-bold mb-2">Session complete</h2>
          <p className="text-dim mb-6">Reviewed {reviewedCount} card{reviewedCount !== 1 ? "s" : ""}.</p>
          <button className="btn-primary" onClick={() => navigate("/flashcards")}>
            Back to Flashcards
          </button>
        </div>
      </div>
    );
  }

  // Always the head of the queue. Grading pushes a card's dueAt into the future
  // so it leaves this live query and the next one shifts into position — which
  // is why the cursor must NOT also advance. It used to do both, skipping every
  // second card: a 20-card session showed about 10.
  const card: Flashcard = dueCards[0];

  async function grade(quality: Quality) {
    if (!profile) return;
    const result = sm2(
      { ease: card.ease, interval: card.interval, reps: card.reps, lapses: card.lapses },
      quality,
    );
    const next = nextReviewDate(new Date(), result.interval);
    await db.flashcards.update(card.id, {
      ease: result.ease,
      interval: result.interval,
      reps: result.reps,
      lapses: result.lapses,
      dueAt: next.toISOString(),
      lastReviewedAt: new Date().toISOString(),
    });
    // Read fresh rather than from the render closure: keyboard grading can fire
    // faster than refreshProfile settles, which dropped XP.
    const current = useProfile.getState().profile ?? profile;
    const xpGain = flashcardXp(quality);

    // Through the shared helper, like the quiz, quest and Vault paths. This was
    // the last surface writing studyLog by hand, and the only one that never
    // advanced the streak — in a spaced-repetition app.
    const streakPatch = await logStudySession(current, {
      minutes: 1,
      flashcardsReviewed: 1,
    });
    // addXp rather than an absolute total: reading the store fresh above closed
    // the fast-keyboard-grading gap, but not the one where the achievement
    // engine writes XP straight to Dexie between that read and this write.
    await addXp(xpGain, streakPatch);

    if ("vibrate" in navigator) navigator.vibrate(5);

    const today = format(new Date(), "yyyy-MM-dd");
    const reviewedToday = (await db.studyLog.get(today))?.flashcardsReviewed ?? 1;
    const totalDeck = await db.flashcards.count();
    await checkAchievements({ kind: "flashcard-review", reviewedToday, totalDeck });
    await refreshProfile();

    setRevealed(false);
    setReviewedCount((n) => n + 1);
    x.set(0);
    y.set(0);
  }

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const threshold = 120;
    const { offset } = info;
    if (!revealed) {
      setRevealed(true);
      x.set(0);
      y.set(0);
      return;
    }
    if (Math.abs(offset.x) > threshold) {
      grade(offset.x < 0 ? 0 : 3); // left=Again, right=Good
    } else if (Math.abs(offset.y) > threshold) {
      grade(offset.y < 0 ? 4 : 1); // up=Perfect, down=Hard
    } else {
      x.set(0);
      y.set(0);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-between p-4 pb-20 md:pb-8">
      <div className="w-full max-w-lg flex items-center justify-between">
        <button onClick={() => navigate("/flashcards")} className="text-dim hover:text-ink" aria-label="Exit review session">
          <span aria-hidden="true">← </span>Exit
        </button>
        {/* The queue drains as cards are graded, so the session total is what's
            been done plus what's left. */}
        <span
          className="text-sm text-dim"
          aria-label={`Card ${reviewedCount + 1} of ${reviewedCount + dueCards.length}`}
          aria-live="polite"
        >
          {reviewedCount + 1} / {reviewedCount + dueCards.length}
        </span>
      </div>

      <div className="flex-1 w-full max-w-lg flex items-center justify-center my-6">
        <motion.div
          key={card.id}
          drag
          dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
          dragElastic={0.8}
          onDragEnd={onDragEnd}
          style={{ x, y, rotate, opacity }}
          role="button"
          tabIndex={0}
          aria-label={revealed ? `Answer: ${card.back}. Use grade buttons or keys 1-4.` : `Question: ${card.front}. Press Space or Enter to reveal.`}
          aria-live="polite"
          className="w-full aspect-[3/4] card bg-panel2 shadow-glow flex flex-col items-center justify-center text-center p-6 cursor-grab active:cursor-grabbing select-none focus-visible:ring-4 focus-visible:ring-accent"
          onClick={() => !revealed && setRevealed(true)}
          onKeyDown={(e) => {
            if ((e.key === " " || e.key === "Enter") && !revealed) {
              e.preventDefault();
              setRevealed(true);
            }
          }}
        >
          <div className="flex-1 flex items-center justify-center w-full">
            <div>
              <p className="text-xs uppercase tracking-wider text-dim mb-3 font-medium">
                {revealed ? "Answer" : "Front"}
              </p>
              <p className="text-xl font-semibold">
                {revealed ? card.back : card.front}
              </p>
            </div>
          </div>
          {!revealed && (
            <p className="text-xs text-dim mt-4" aria-hidden="true">Tap or press Space to reveal</p>
          )}
          {card.domainId && (
            <div className="absolute top-3 right-3">
              <span className="chip text-[10px]">
                <span className="sr-only">Domain </span>D{card.domainId}
              </span>
            </div>
          )}
        </motion.div>
      </div>

      {revealed ? (
        <div
          role="group"
          aria-label="Grade this card"
          className="w-full max-w-lg grid grid-cols-4 gap-2"
        >
          <button onClick={() => grade(0)} aria-label="Again — grade 1 of 4 — I did not know this" aria-keyshortcuts="1" className="btn-ghost !bg-danger/15 text-danger flex-col py-3 text-xs">
            <span className="text-lg" aria-hidden="true">❌</span>
            Again
            <span className="text-[10px] text-dim" aria-hidden="true">1</span>
          </button>
          <button onClick={() => grade(1)} aria-label="Hard — grade 2 of 4" aria-keyshortcuts="2" className="btn-ghost !bg-warn/15 text-warn flex-col py-3 text-xs">
            <span className="text-lg" aria-hidden="true">😞</span>
            Hard
            <span className="text-[10px] text-dim" aria-hidden="true">2</span>
          </button>
          <button onClick={() => grade(3)} aria-label="Good — grade 3 of 4" aria-keyshortcuts="3" className="btn-ghost !bg-accent/15 text-accent flex-col py-3 text-xs">
            <span className="text-lg" aria-hidden="true">✅</span>
            Good
            <span className="text-[10px] text-dim" aria-hidden="true">3</span>
          </button>
          <button onClick={() => grade(4)} aria-label="Perfect — grade 4 of 4 — I knew this cold" aria-keyshortcuts="4" className="btn-ghost !bg-high/15 text-high flex-col py-3 text-xs">
            <span className="text-lg" aria-hidden="true">🔥</span>
            Perfect
            <span className="text-[10px] text-dim" aria-hidden="true">4</span>
          </button>
        </div>
      ) : (
        <div className="text-xs text-dim text-center" aria-hidden="true">
          Swipe: ← Again · → Good · ↑ Perfect · ↓ Hard
        </div>
      )}
    </div>
  );
}
