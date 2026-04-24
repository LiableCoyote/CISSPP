import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { db, type Question, type QuizAttempt, type QuizAnswer } from "../../db/schema";
import { ALL_QUESTIONS } from "../../data/questions.seed";
import { isSpeedReader, isTechnicianAnswer, getSpeedReaderNudge, getTechnicianNudge } from "./detectors";
import { useProfile } from "../../state/profile";

function pickQuestions(
  mode: "domain" | "mixed" | "full",
  domainId: number | null,
): Question[] {
  let pool = [...ALL_QUESTIONS];
  if (mode === "domain" && domainId) {
    pool = pool.filter((q) => q.domainId === domainId);
  }
  // Shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const limit = mode === "full" ? Math.min(pool.length, 150) : mode === "mixed" ? Math.min(pool.length, 50) : Math.min(pool.length, 25);
  return pool.slice(0, limit);
}

export default function QuizSessionPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { profile } = useProfile();

  const mode = (params.get("mode") || "domain") as "domain" | "mixed" | "full";
  const domainId = params.get("domain") ? parseInt(params.get("domain")!, 10) : null;

  const questions = useMemo(() => pickQuestions(mode, domainId), [mode, domainId]);
  const [attemptId] = useState(() => `attempt-${Date.now()}`);
  const [startedAt] = useState(() => new Date());
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [nudge, setNudge] = useState<string | null>(null);
  const [answers, setAnswers] = useState<QuizAnswer[]>([]);
  const [timeLeft, setTimeLeft] = useState<number>(
    mode === "full" ? 3 * 60 * 60 : mode === "mixed" ? 60 * 60 : 25 * 60,
  );
  const questionStart = useRef<number>(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setTimeLeft((t) => Math.max(0, t - 1)), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (timeLeft === 0) finalize();
  }, [timeLeft]); // eslint-disable-line

  useEffect(() => {
    questionStart.current = Date.now();
    setPicked(null);
    setSubmitted(false);
    setShowExplanation(false);
    setNudge(null);
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
          setPicked(parseInt(e.key) - 1);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [submitted]);

  if (!profile) return null;
  if (questions.length === 0) {
    return (
      <div className="page text-center">
        <p className="text-dim">No questions available for this selection.</p>
        <button className="btn-primary mt-4" onClick={() => navigate("/quiz")}>Back</button>
      </div>
    );
  }

  const q = questions[idx];
  const isLast = idx === questions.length - 1;

  const submit = async () => {
    if (picked === null) return;
    const timeTakenMs = Date.now() - questionStart.current;
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
    };
    setAnswers((a) => [...a, answer]);
    await db.answers.add(answer);

    // Update CISO-thinking counters on the profile row. Read-modify-write on the
    // DB directly so rapid-fire submits don't race against stale closures.
    const fresh = await db.profile.get(1);
    if (fresh) {
      const patch: Partial<typeof fresh> = {};
      if (q.isMindsetHeavy && correct) patch.mindsetChoicesCorrect = fresh.mindsetChoicesCorrect + 1;
      if (tech) patch.technicianMisses = fresh.technicianMisses + 1;
      if (speed && !correct) patch.speedReaderMisses = fresh.speedReaderMisses + 1;
      if (Object.keys(patch).length > 0) await db.profile.update(1, patch);
    }

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
    } else {
      setIdx((i) => i + 1);
    }
  };

  const finalize = async () => {
    const finishedAt = new Date();
    const totalSeconds = Math.round((finishedAt.getTime() - startedAt.getTime()) / 1000);
    const correct = answers.filter((a) => a.correct).length;
    const target = mode === "full" ? 70 : null;
    const scorePct = Math.round((correct / questions.length) * 100);
    const attempt: QuizAttempt = {
      id: attemptId,
      mode,
      domainId: domainId as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | null,
      questionIds: questions.map((x) => x.id),
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      totalSeconds,
      score: correct,
      scorePct,
      passed: target !== null ? scorePct >= target : null,
      targetScorePct: target,
    };
    await db.attempts.add(attempt);
    navigate(`/quiz/review/${attemptId}`);
  };

  const fmtTime = (s: number) =>
    `${String(Math.floor(s / 3600)).padStart(1, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const modeLabel = mode === "full" ? "FULL EXAM 🐉" : mode === "mixed" ? "Mixed Set" : `Domain ${domainId}`;

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
          {q.options.map((opt, i) => {
            const isCorrect = submitted && i === q.answerIndex;
            const isPicked = picked === i;
            const isWrong = submitted && isPicked && !isCorrect;
            const letter = String.fromCharCode(65 + i);
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
