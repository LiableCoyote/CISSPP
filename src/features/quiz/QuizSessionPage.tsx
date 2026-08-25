import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { db, type Question, type QuizAttempt, type QuizAnswer } from "../../db/schema";
import { ALL_QUESTIONS } from "../../data/questions.seed";
import { dueReviews } from "../../lib/questionSrs";
import { recordAnswer, finalizeAttempt } from "../../lib/quizWrites";
import { reportFailure } from "../../lib/failure";
import { isSpeedReader, isTechnicianAnswer, getSpeedReaderNudge, getTechnicianNudge } from "./detectors";
import { useProfile } from "../../state/profile";
import {
  pickQuestions,
  scoreQuiz,
  didPass,
  targetScorePct,
  describeMode,
  optionOrder,
  MODE_LIMITS,
  MODE_SECONDS,
  type QuizMode,
} from "../../lib/scoring";

export default function QuizSessionPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { profile } = useProfile();

  const mode = (params.get("mode") || "domain") as QuizMode;
  const domainId = params.get("domain") ? parseInt(params.get("domain")!, 10) : null;

  // Misses mode draws from questionReviews, which needs a DB read. Loaded once
  // into state rather than through useLiveQuery: a live query would reorder the
  // queue underneath the user as each answer reschedules its own row — the same
  // shifting-cursor bug the flashcard session had.
  // `null` means still loading, which is not the same as "nothing due".
  const [missPool, setMissPool] = useState<Question[] | null>(null);
  useEffect(() => {
    if (mode !== "misses") return;
    let cancelled = false;
    void (async () => {
      const rows = await db.questionReviews.toArray();
      const byId = new Map(ALL_QUESTIONS.map((q) => [q.id, q]));
      const due = dueReviews(rows, new Date(), MODE_LIMITS.misses)
        .map((r) => byId.get(r.questionId))
        .filter((q): q is Question => !!q);
      if (!cancelled) setMissPool(due);
    })();
    return () => {
      cancelled = true;
    };
  }, [mode]);

  const questions = useMemo(() => {
    // Not run through pickQuestions: dueReviews has already ordered these
    // hardest-first and applied the limit, and shuffling would throw that away.
    if (mode === "misses") return missPool ?? [];
    return pickQuestions(ALL_QUESTIONS, mode, domainId);
  }, [mode, domainId, missPool]);
  const [attemptId] = useState(() => `attempt-${Date.now()}`);
  const [startedAt] = useState(() => new Date());
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [confidence, setConfidence] = useState<1 | 2 | 3 | 4 | 5 | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [nudge, setNudge] = useState<string | null>(null);
  const [answers, setAnswers] = useState<QuizAnswer[]>([]);
  const [timeLeft, setTimeLeft] = useState<number>(MODE_SECONDS[mode]);
  // Set when each question is shown. Not seeded with Date.now() at the useRef
  // call, because that argument is re-evaluated on every render.
  const questionStart = useRef<number | null>(null);

  // Declared ahead of the effects that call it — it was previously a const arrow
  // defined ~100 lines below the effect referencing it.
  // Two callers race for this — the last question's "Finish", and the clock
  // reaching zero — and the timeout effect below depends on `finalize`, which
  // React rebuilds whenever `answers` changes, so it can fire twice on its own.
  // The ref stops the second pass before it starts; finalizeAttempt is
  // idempotent as well, because a ref does not survive a remount.
  const finalizing = useRef(false);

  const finalize = useCallback(async () => {
    if (finalizing.current) return;
    finalizing.current = true;

    const finishedAt = new Date();
    const totalSeconds = Math.round((finishedAt.getTime() - startedAt.getTime()) / 1000);
    const { score, scorePct } = scoreQuiz(answers, questions.length);
    const attempt: QuizAttempt = {
      id: attemptId,
      mode,
      domainId: domainId as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | null,
      questionIds: questions.map((x) => x.id),
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      totalSeconds,
      score,
      scorePct,
      passed: didPass(scorePct, mode),
      targetScorePct: targetScorePct(mode),
    };

    try {
      await finalizeAttempt(attempt);
    } catch (err) {
      // Released, so the user is not stranded: without this a failed write left
      // a timed-out exam sitting at 0:00 with nothing said and no way forward.
      finalizing.current = false;
      reportFailure(
        "save your quiz result",
        err,
        "The attempt wasn't stored. Try finishing again.",
      );
      return;
    }
    navigate(`/quiz/review/${attemptId}`);
  }, [answers, attemptId, domainId, mode, navigate, questions, startedAt]);

  useEffect(() => {
    const timer = setInterval(() => setTimeLeft((t) => Math.max(0, t - 1)), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // finalize() reports its own failures, but an explicit catch keeps a
    // floating rejection from escaping if anything above the try ever throws.
    if (timeLeft === 0) {
      finalize().catch((err: unknown) => console.error("Finalizing the attempt:", err));
    }
  }, [timeLeft, finalize]);

  // Refs and focus only — the per-question state reset moved into next(), so
  // this effect no longer calls setState.
  useEffect(() => {
    questionStart.current = Date.now();
    // Move focus to the question for screen readers when advancing
    const el = document.getElementById("main-content");
    el?.focus();
  }, [idx]);

  // Keyboard shortcuts: 1-4 to pick option, Enter to submit/next
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLButtonElement || e.target instanceof HTMLInputElement) return;
      if (!submitted) {
        if (["1", "2", "3", "4"].includes(e.key)) {
          // The number keys address what's on screen, so map the slot back to
          // the canonical index the rest of the flow expects. optionOrder is
          // deterministic from its seed, so recomputing it here yields exactly
          // the order being rendered — no shared ref needed.
          const cur = questions[idx];
          if (!cur) return;
          const slot = parseInt(e.key) - 1;
          const canonical = optionOrder(cur.options.length, `${attemptId}-${cur.id}`)[slot];
          if (canonical !== undefined) setPicked(canonical);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [submitted, questions, idx, attemptId]);

  if (!profile) return null;
  // Loading is not emptiness — without this the misses queue flashes "nothing
  // to retry" for a frame before the DB read lands.
  if (mode === "misses" && missPool === null) {
    return <div className="page text-dim">Loading your misses…</div>;
  }
  if (questions.length === 0) {
    return (
      <div className="page text-center">
        <p className="text-dim">
          {mode === "misses"
            ? "Nothing due for retry. Miss a question and it'll show up here."
            : "No questions available for this selection."}
        </p>
        <button className="btn-primary mt-4" onClick={() => navigate("/quiz")}>Back</button>
      </div>
    );
  }

  const q = questions[idx];
  const isLast = idx === questions.length - 1;

  // Seeded on the attempt and the question, so the order is fixed for this
  // question in this attempt and does not reshuffle on every re-render.
  const optionSlots = optionOrder(q.options.length, `${attemptId}-${q.id}`);

  const submit = async () => {
    if (picked === null) return;
    const timeTakenMs = questionStart.current === null ? 0 : Date.now() - questionStart.current;
    const speed = isSpeedReader(timeTakenMs);
    const tech = isTechnicianAnswer(q, picked);
    const correct = picked === q.answerIndex;

    const answer: QuizAnswer = {
      id: `${attemptId}-${q.id}`,
      attemptId,
      questionId: q.id,
      pickedIndex: picked,
      correct,
      timeTakenMs,
      flaggedMindset: tech,
      flaggedSpeed: speed,
      missCategory: null,
      confidence,
    };

    // Write first, then touch state. The other order is what let a failed write
    // pass unnoticed and, on the retry it invited, count the same answer twice
    // in the score.
    try {
      await recordAnswer(answer, q);
    } catch (err) {
      reportFailure(
        "save that answer",
        err,
        "Nothing was recorded for this question — submit it again to retry.",
      );
      return;
    }

    // De-duplicated by id as well as being an idempotent write: this is the
    // line that actually keeps the score honest, since finalize() totals this
    // array rather than the stored rows.
    setAnswers((a) => [...a.filter((x) => x.id !== answer.id), answer]);

    // Nudge on wrong answers only
    if (!correct) {
      if (tech) setNudge(getTechnicianNudge());
      else if (speed) setNudge(getSpeedReaderNudge());
    }

    if ("vibrate" in navigator) navigator.vibrate(correct ? 5 : [10, 50, 10]);

    setSubmitted(true);
    setShowExplanation(true);
  };

  const next = async () => {
    if (isLast) {
      await finalize();
      return;
    }
    // Reset here rather than in an effect keyed on `idx`: the advance is the
    // event that invalidates this question's state.
    setIdx((i) => i + 1);
    setPicked(null);
    setConfidence(null);
    setSubmitted(false);
    setShowExplanation(false);
    setNudge(null);
  };

  const fmtTime = (s: number) =>
    `${String(Math.floor(s / 3600)).padStart(1, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const modeLabel = mode === "full" ? "FULL EXAM 🐉" : describeMode(mode, domainId);

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      {/* Top bar */}
      <div className="sticky top-0 bg-bg/95 backdrop-blur border-b border-border p-3 flex items-center justify-between safe-top" role="banner">
        <div className="text-xs text-dim">
          <span className="font-semibold text-ink">{modeLabel}</span>
          <span className="ml-2" aria-label={`Question ${idx + 1} of ${questions.length}`}>
            Q {idx + 1}/{questions.length}
          </span>
        </div>
        <div
          className={`font-mono text-sm font-bold ${timeLeft < 60 ? "text-danger animate-flicker" : timeLeft < 300 ? "text-warn" : "text-ink"}`}
          role="timer"
          aria-live={timeLeft <= 60 ? "assertive" : "off"}
          aria-label={`Time remaining: ${fmtTime(timeLeft)}`}
        >
          <span aria-hidden="true">{fmtTime(timeLeft)}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div
        className="h-1 bg-panel2"
        role="progressbar"
        aria-label="Quiz progress"
        aria-valuenow={idx + 1}
        aria-valuemin={1}
        aria-valuemax={questions.length}
        aria-valuetext={`Question ${idx + 1} of ${questions.length}`}
      >
        <div
          className="h-full bg-accent transition-all"
          style={{ width: `${((idx + 1) / questions.length) * 100}%` }}
        />
      </div>

      {/* Question */}
      <main id="main-content" tabIndex={-1} className="flex-1 p-4 pb-32 md:pb-24 max-w-2xl mx-auto w-full focus:outline-none">
        <div className="text-xs text-dim mb-2">
          <span className="sr-only">Domain </span>D{q.domainId}
        </div>
        <h1 className="text-lg leading-relaxed mb-5" id={`q-${q.id}`}>{q.prompt}</h1>

        <div role="radiogroup" aria-labelledby={`q-${q.id}`} className="space-y-2">
          {/* Iterating the permutation, not q.options: `i` is the canonical
              index and `slot` is where it appears on screen. `picked` stays
              canonical throughout, so submit() and everything downstream needs
              no translation. */}
          {optionSlots.map((i, slot) => {
            const opt = q.options[i];
            const isCorrect = submitted && i === q.answerIndex;
            const isPicked = picked === i;
            const isWrong = submitted && isPicked && !isCorrect;
            const letter = String.fromCharCode(65 + slot);
            const describedBy = isCorrect ? `status-${i}` : isWrong ? `status-${i}` : undefined;
            return (
              <button
                key={i}
                role="radio"
                aria-checked={isPicked}
                aria-describedby={describedBy}
                onClick={() => !submitted && setPicked(i)}
                disabled={submitted}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  isCorrect
                    ? "border-high bg-high/15"
                    : isWrong
                    ? "border-danger bg-danger/15"
                    : isPicked
                    ? "border-accent bg-accent/10"
                    : "border-border bg-panel hover:border-accent/50 active:border-accent"
                }`}
              >
                <div className="flex items-start gap-2">
                  <span
                    aria-hidden="true"
                    className={`w-6 h-6 rounded border flex items-center justify-center text-xs font-bold shrink-0 ${
                      isCorrect ? "border-high text-high" : isPicked ? "border-accent text-accent" : "border-border text-dim"
                    }`}
                  >
                    {letter}
                  </span>
                  <span className="sr-only">Option {letter}. </span>
                  <span className="text-sm flex-1">{opt}</span>
                  {isCorrect && (
                    <span id={`status-${i}`} className="text-high">
                      <span className="sr-only">Correct answer</span>
                      <span aria-hidden="true">✓</span>
                    </span>
                  )}
                  {isWrong && (
                    <span id={`status-${i}`} className="text-danger">
                      <span className="sr-only">Your incorrect answer</span>
                      <span aria-hidden="true">✗</span>
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {!submitted && picked !== null && (
          <div className="card mt-4">
            <p className="text-xs uppercase tracking-wider text-dim mb-2" id={`conf-label-${q.id}`}>
              How confident are you? (optional)
            </p>
            <div role="radiogroup" aria-labelledby={`conf-label-${q.id}`} className="flex justify-between gap-2">
              {([
                [1, "😰", "Guessing"],
                [2, "😕", "Unsure"],
                [3, "🤔", "Leaning"],
                [4, "🙂", "Confident"],
                [5, "💪", "Certain"],
              ] as const).map(([val, emoji, label]) => (
                <button
                  key={val}
                  role="radio"
                  aria-checked={confidence === val}
                  aria-label={`${label} — ${val} of 5`}
                  onClick={() => setConfidence(confidence === val ? null : val)}
                  className={`flex-1 min-h-[48px] rounded-lg border transition-colors text-2xl ${
                    confidence === val
                      ? "border-accent bg-accent/15"
                      : "border-border bg-panel2 hover:border-accent/40"
                  }`}
                >
                  <span aria-hidden="true">{emoji}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {nudge && (
          <div className="card mt-4 border-warn/40 bg-warn/5" role="alert">
            <p className="text-sm">
              <span className="text-warn font-semibold" aria-hidden="true">⚠️ </span>
              {nudge}
            </p>
          </div>
        )}

        {showExplanation && (
          <section aria-label="Explanation" className="card mt-4 border-accent/40 bg-accent/5">
            <p className="text-xs uppercase tracking-wider text-accent mb-1 font-medium">Explanation</p>
            <p className="text-sm">{q.explanation}</p>
          </section>
        )}
      </main>

      {/* Sticky action */}
      <div className="fixed bottom-0 inset-x-0 bg-bg/95 backdrop-blur border-t border-border p-3 safe-bottom md:bottom-0">
        <div className="max-w-2xl mx-auto">
          {!submitted ? (
            <button
              onClick={submit}
              disabled={picked === null}
              className="btn-primary w-full disabled:opacity-40"
            >
              Submit & Lock
            </button>
          ) : (
            <button onClick={next} className="btn-primary w-full">
              {isLast ? "Finish Exam →" : "Next Question →"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
