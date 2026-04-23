import { useParams, useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type QuizAnswer } from "../../db/schema";
import { ALL_QUESTIONS } from "../../data/questions.seed";
import { useProfile } from "../../state/profile";

export default function QuizReviewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile, updateProfile } = useProfile();

  const attempt = useLiveQuery(() => db.attempts.get(id!), [id]);
  const answers = useLiveQuery(
    () => db.answers.where("attemptId").equals(id!).toArray(),
    [id],
  );

  if (!attempt || !answers || !profile) return <div className="page text-dim">Loading…</div>;

  const missed = answers.filter((a) => !a.correct);

  const setMissCategory = async (answerId: string, category: QuizAnswer["missCategory"]) => {
    await db.answers.update(answerId, { missCategory: category });
  };

  const addToFlashcards = async (answer: QuizAnswer) => {
    const q = ALL_QUESTIONS.find((x) => x.id === answer.questionId);
    if (!q) return;
    const now = new Date().toISOString();
    await db.flashcards.add({
      id: `miss-${answer.id}`,
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
    if ("vibrate" in navigator) navigator.vibrate(5);
  };

  const awardComplete = async () => {
    // XP based on accuracy
    const xpGain = Math.round(attempt.scorePct * 2) + (attempt.mode === "full" ? 200 : attempt.mode === "mixed" ? 50 : 25);
    await updateProfile({ xp: profile.xp + xpGain });
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

      {/* Missed questions */}
      {missed.length > 0 && (
        <>
          <h2 className="text-lg font-semibold mb-3">Misses ({missed.length})</h2>
          <div className="space-y-3">
            {missed.map((a) => {
              const q = ALL_QUESTIONS.find((x) => x.id === a.questionId);
              if (!q) return null;
              return (
                <div key={a.id} className="card">
                  <div className="flex items-start gap-2 mb-2">
                    <span className="chip">D{q.domainId}</span>
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

                  <div className="flex gap-2 flex-wrap">
                    <p className="text-xs text-dim w-full">Mark miss as:</p>
                    {(["mindset", "knowledge", "misread"] as const).map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setMissCategory(a.id, cat)}
                        className={`pill text-xs px-3 py-1 ${
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
                      className="pill text-xs bg-xp/15 text-xp px-3 py-1 hover:bg-xp/25 ml-auto"
                    >
                      + Flashcard
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <button onClick={awardComplete} className="btn-primary w-full mt-8">
        Claim XP & Finish
      </button>
    </div>
  );
}
