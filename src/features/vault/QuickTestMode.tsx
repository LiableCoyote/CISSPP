import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { OrderGameDef } from "../../data/vault";
import { buildQuickTest, QUICK_TEST_SECONDS, type QuickTestQuestion } from "./quickTest";
import { checkAchievements } from "../achievements/engine";
import { pushToast } from "../../state/toast";

const QUESTION_COUNT = 5;

export default function QuickTestMode({
  game,
  onClose,
}: {
  game: OrderGameDef;
  onClose: () => void;
}) {
  const questions = useMemo<QuickTestQuestion[]>(
    () => buildQuickTest(game, QUESTION_COUNT),
    [game],
  );

  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(QUICK_TEST_SECONDS);
  const [done, setDone] = useState(false);
  const reportedRef = useRef(false);

  const q = questions[index];
  const answered = picked !== null;
  const isLast = index === questions.length - 1;

  // Per-question countdown. Running out marks the question missed (picked = -1).
  useEffect(() => {
    if (done || answered) return;
    const t = setTimeout(() => {
      if (secondsLeft <= 1) setPicked(-1);
      else setSecondsLeft(secondsLeft - 1);
    }, 1000);
    return () => clearTimeout(t);
  }, [secondsLeft, answered, done]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const scorePct = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;

  // Report once, after the score screen renders.
  useEffect(() => {
    if (!done || reportedRef.current) return;
    reportedRef.current = true;
    checkAchievements({ kind: "vault-quick-test", tableId: game.id, scorePct });
    pushToast({
      variant: scorePct === 100 ? "success" : scorePct >= 60 ? "info" : "warn",
      icon: scorePct === 100 ? "🏛️" : scorePct >= 60 ? "✅" : "📖",
      title: `${game.title}: ${scorePct}%`,
      body:
        scorePct === 100
          ? "Perfect recall. That sequence is locked in."
          : `${correctCount} of ${questions.length} correct. Re-drag the order, then retest.`,
    });
  }, [done, scorePct, correctCount, questions.length, game.id, game.title]);

  const pick = (i: number) => {
    if (answered) return;
    setPicked(i);
    if (i === q.answerIndex) {
      setCorrectCount((c) => c + 1);
      if ("vibrate" in navigator) navigator.vibrate(15);
    } else if ("vibrate" in navigator) {
      navigator.vibrate([30, 40, 30]);
    }
  };

  const next = () => {
    if (isLast) {
      setDone(true);
      return;
    }
    setIndex((i) => i + 1);
    setPicked(null);
    setSecondsLeft(QUICK_TEST_SECONDS);
  };

  const restart = () => {
    setIndex(0);
    setPicked(null);
    setCorrectCount(0);
    setSecondsLeft(QUICK_TEST_SECONDS);
    setDone(false);
    reportedRef.current = false;
  };

  if (questions.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="quicktest-title"
      className="fixed inset-0 z-[60] bg-bg/95 backdrop-blur flex items-center justify-center p-4 safe-top safe-bottom"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 26 }}
        onClick={(e) => e.stopPropagation()}
        className="card max-w-lg w-full max-h-full overflow-y-auto no-scrollbar"
      >
        {done ? (
          <div className="text-center py-4">
            <p className="text-5xl mb-3" aria-hidden="true">
              {scorePct === 100 ? "🏛️" : scorePct >= 60 ? "👍" : "📖"}
            </p>
            <h2 id="quicktest-title" className="text-xl font-bold">
              {scorePct}%
            </h2>
            <p className="text-sm text-dim mt-1">
              {correctCount} of {questions.length} correct · {game.title}
            </p>
            <p className="text-xs text-dim mt-4 text-left bg-panel2 rounded-lg p-3">
              <span className="font-semibold text-ink">Why it matters: </span>
              {game.why}
            </p>
            <div className="flex gap-2 mt-5">
              <button onClick={restart} className="btn-outline flex-1">
                Retest
              </button>
              <button onClick={onClose} className="btn-primary flex-1">
                Done
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <h2 id="quicktest-title" className="text-sm font-semibold">
                Quick Test · {index + 1}/{questions.length}
              </h2>
              <button
                onClick={onClose}
                className="text-dim hover:text-ink text-xl leading-none px-2"
                aria-label="Close quick test"
              >
                ×
              </button>
            </div>

            {/* Timer */}
            <div
              className="h-1 bg-panel2 rounded-full overflow-hidden mb-4"
              role="progressbar"
              aria-label="Time remaining"
              aria-valuenow={secondsLeft}
              aria-valuemin={0}
              aria-valuemax={QUICK_TEST_SECONDS}
              aria-valuetext={`${secondsLeft} seconds remaining`}
            >
              <div
                className={`h-full transition-all duration-1000 ease-linear ${
                  secondsLeft <= 5 ? "bg-danger" : "bg-accent"
                }`}
                style={{ width: `${(secondsLeft / QUICK_TEST_SECONDS) * 100}%` }}
              />
            </div>

            <p className="font-medium mb-4">{q.prompt}</p>

            <div className="space-y-2" role="group" aria-label="Answer options">
              {q.options.map((opt, i) => {
                const isAnswer = i === q.answerIndex;
                const isPicked = i === picked;
                let cls = "list-row w-full text-left";
                if (answered && isAnswer) cls += " !border-high !bg-high/10";
                else if (answered && isPicked) cls += " !border-danger !bg-danger/10";
                else if (answered) cls += " opacity-50";
                return (
                  <button
                    key={i}
                    onClick={() => pick(i)}
                    disabled={answered}
                    className={cls}
                    aria-label={`${opt}${
                      answered ? (isAnswer ? " — correct answer" : isPicked ? " — your answer, incorrect" : "") : ""
                    }`}
                  >
                    <span className="text-dim text-xs w-5 shrink-0" aria-hidden="true">
                      {i + 1}.
                    </span>
                    <span className="flex-1">{opt}</span>
                  </button>
                );
              })}
            </div>

            <AnimatePresence>
              {answered && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="overflow-hidden"
                >
                  <p
                    className="text-xs text-dim bg-panel2 rounded-lg p-3 mt-4"
                    role="status"
                    aria-live="polite"
                  >
                    <span
                      className={`font-semibold ${picked === q.answerIndex ? "text-high" : "text-danger"}`}
                    >
                      {picked === q.answerIndex ? "Correct. " : picked === -1 ? "Time's up. " : "Not quite. "}
                    </span>
                    {q.explain}
                  </p>
                  <button onClick={next} className="btn-primary w-full mt-3">
                    {isLast ? "See Score" : "Next →"}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
