import { useParams, useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { format } from "date-fns";
import { db, type QuizAnswer } from "../../db/schema";
import { ALL_QUESTIONS } from "../../data/questions.seed";
import { useProfile } from "../../state/profile";
import { checkAchievements } from "../achievements/engine";
import { claimQuizAttempt } from "../../lib/awards";
import { publishLastActive } from "../../lib/reminders";
import { reportFailure } from "../../lib/failure";
import { pushToast } from "../../state/toast";

export default function QuizReviewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile, refreshProfile } = useProfile();

  const attempt = useLiveQuery(() => db.attempts.get(id!), [id]);
  const answers = useLiveQuery(
    () => db.answers.where("attemptId").equals(id!).toArray(),
    [id],
  );

  if (!attempt || !answers || !profile) return <div className="page text-dim">Loading…</div>;

  const missed = answers.filter((a) => !a.correct);
  const confidentMisses = missed.filter((a) => a.confidence !== null && a.confidence >= 4);

  const setMissCategory = async (answerId: string, category: QuizAnswer["missCategory"]) => {
    await db.answers.update(answerId, { missCategory: category });
  };

  const addToFlashcards = async (answer: QuizAnswer) => {
    const q = ALL_QUESTIONS.find((x) => x.id === answer.questionId);
    if (!q) return;
    const cardId = `miss-${answer.id}`;

    // The id is derived from the answer, so a second tap used to throw
    // ConstraintError as an unhandled rejection — and the first tap gave no
    // feedback beyond a 5ms vibrate, so tapping twice was the natural thing to
    // do. Deliberately not a put(): the row carries SM-2 scheduling state, and
    // overwriting would reset the schedule on a card already being revised.
    try {
      if (await db.flashcards.get(cardId)) {
        pushToast({
          variant: "info",
          icon: "📇",
          title: "Already in your deck",
          body: "This one was added earlier — its review schedule is untouched.",
          durationMs: 2500,
        });
        return;
      }
    } catch (err) {
      reportFailure("add that to your flashcards", err);
      return;
    }

    const now = new Date().toISOString();
    try {
      await db.flashcards.add({
        id: cardId,
        front: q.prompt,
        back: `Correct: ${q.options[q.answerIndex]}\n\n${q.explanation}`,
        domainId: q.domainId,
        tags: ["quiz-miss", ...q.tags],
        ease: 2.5,
        interval: 0,
        reps: 0,
        lapses: 0,
        dueAt: now,
        lastReviewedAt: null,
        createdAt: now,
        source: "quiz-miss",
      });
    } catch (err) {
      reportFailure("add that to your flashcards", err);
      return;
    }
    if ("vibrate" in navigator) navigator.vibrate(5);
    pushToast({
      variant: "success",
      icon: "📇",
      title: "Added to your flashcards",
      body: "It'll come round in your next review session.",
      durationMs: 2500,
    });
  };

  const claimed = !!attempt.claimedAt;

  const awardComplete = async () => {
    // The review page is an ordinary URL, so this handler was reachable on every
    // visit — going back and tapping again re-awarded the XP, re-logged the
    // session and re-ran the achievement checks. Claim exactly once.
    if (claimed) {
      navigate("/");
      return;
    }

    // One transaction, in lib/awards.ts so the rollback is testable without a
    // DOM. Claiming first and awarding afterwards is only safe if a failure
    // undoes the claim, and it didn't.
    try {
      await claimQuizAttempt(profile, attempt);
    } catch (err) {
      reportFailure(
        "save your quiz result",
        err,
        "Nothing was recorded, and the attempt is still unclaimed — tap Claim again to retry.",
      );
      return;
    }

    // Everything below is outside the transaction on purpose: a Cache API
    // write, a store sync, and the achievement checks, which do their own
    // writes and have their own retry queue.
    await publishLastActive(format(new Date(), "yyyy-MM-dd"));
    await refreshProfile();
    await checkAchievements({ kind: "quiz-complete", attemptId: attempt.id });
    navigate("/");
  };

  const scoreColor =
    attempt.scorePct >= 75 ? "text-high" : attempt.scorePct >= 60 ? "text-warn" : "text-danger";

  return (
    <div className="page">
      <h1 className="text-2xl font-bold mb-4">Quiz Review</h1>

      {/* Results summary */}
      <div className="card mb-6 text-center py-6 shadow-glow">
        <p className="text-xs uppercase tracking-wider text-dim mb-1">Score</p>
        <p className={`text-6xl font-bold ${scoreColor}`}>{attempt.scorePct}%</p>
        <p className="text-dim mt-2">
          {attempt.score}/{attempt.questionIds.length} correct
        </p>
        {attempt.passed === true && (
          <p className="text-high font-semibold mt-3">✓ Passed target ({attempt.targetScorePct}%)</p>
        )}
        {attempt.passed === false && (
          <p className="text-danger font-semibold mt-3">
            Below target ({attempt.targetScorePct}%). Time to review.
          </p>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-6">
        <div className="card p-3 text-center">
          <p className="text-xs text-dim">Missed</p>
          <p className="text-xl font-bold text-danger">{missed.length}</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-xs text-dim">Technician flags</p>
          <p className="text-xl font-bold text-warn">{missed.filter((m) => m.flaggedMindset).length}</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-xs text-dim">Speed flags</p>
          <p className="text-xl font-bold text-warn">{missed.filter((m) => m.flaggedSpeed).length}</p>
        </div>
      </div>

      {confidentMisses.length > 0 && (
        <div className="card mb-6 border-danger/40 bg-danger/5" role="note">
          <p className="text-sm">
            <span className="font-semibold text-danger">
              <span aria-hidden="true">🎯 </span>Overconfidence detected:
            </span>{" "}
            {confidentMisses.length} miss{confidentMisses.length === 1 ? "" : "es"} on question
            {confidentMisses.length === 1 ? "" : "s"} where you rated yourself confident (4-5).
            These are the highest-signal review targets.
          </p>
        </div>
      )}

      {/* Missed questions */}
      {missed.length > 0 && (
        <>
          <h2 className="text-lg font-semibold mb-3">Misses ({missed.length})</h2>
          <div className="space-y-3">
            {missed.map((a) => {
              const q = ALL_QUESTIONS.find((x) => x.id === a.questionId);
              if (!q) return null;
              const overconfident = a.confidence !== null && a.confidence >= 4;
              return (
                <div key={a.id} className={`card ${overconfident ? "border-danger/60" : ""}`}>
                  <div className="flex items-start gap-2 mb-2 flex-wrap">
                    <span className="chip">D{q.domainId}</span>
                    {overconfident && (
                      <span className="pill bg-danger/15 text-danger text-[10px]">
                        confident but wrong
                      </span>
                    )}
                    {a.flaggedMindset && <span className="pill bg-warn/15 text-warn text-[10px]">technician</span>}
                    {a.flaggedSpeed && <span className="pill bg-warn/15 text-warn text-[10px]">speed</span>}
                  </div>
                  <p className="font-medium text-sm mb-2">{q.prompt}</p>
                  <p className="text-sm text-danger mb-1">
                    ✗ You: {a.pickedIndex !== null ? q.options[a.pickedIndex] : "—"}
                  </p>
                  <p className="text-sm text-high mb-3">
                    ✓ Correct: {q.options[q.answerIndex]}
                  </p>
                  <p className="text-xs text-dim mb-3">{q.explanation}</p>

                  <div className="flex gap-2 flex-wrap" role="radiogroup" aria-label={`Categorize this miss for question ${q.id}`}>
                    <p className="text-xs text-dim w-full" id={`miss-cat-${a.id}`}>Mark miss as:</p>
                    {(["mindset", "knowledge", "misread"] as const).map((cat) => (
                      <button
                        key={cat}
                        role="radio"
                        aria-checked={a.missCategory === cat}
                        onClick={() => setMissCategory(a.id, cat)}
                        className={`pill text-xs px-3 py-1 min-h-[32px] ${
                          a.missCategory === cat
                            ? "bg-accent text-bg"
                            : "bg-panel2 text-dim hover:bg-border"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                    <button
                      onClick={() => addToFlashcards(a)}
                      aria-label="Add this missed question to flashcards"
                      className="pill text-xs bg-xp/15 text-xp px-3 py-1 hover:bg-xp/25 ml-auto min-h-[32px]"
                    >
                      <span aria-hidden="true">+ </span>Flashcard
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <button onClick={awardComplete} className="btn-primary w-full mt-8">
        {claimed ? "Back to Dashboard" : "Claim XP & Finish"}
      </button>
      {claimed && (
        <p className="text-xs text-dim text-center mt-2">
          XP for this attempt was already claimed.
        </p>
      )}
    </div>
  );
}
