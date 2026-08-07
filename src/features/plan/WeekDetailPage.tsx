import { useParams, Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Quest } from "../../db/schema";
import { WEEK_META } from "../../data/weeks";
import { useProfile } from "../../state/profile";
import { checkAchievements } from "../achievements/engine";
import { pushToast } from "../../state/toast";
import { logStudySession } from "../../lib/session";
import EmptyState from "../../components/ui/EmptyState";

/** Rough minutes credited per quest type, used for the study log. */
const QUEST_MINUTES: Record<string, number> = {
  watch: 25,
  read: 20,
  quiz: 35,
  exam: 180,
  flashcards: 15,
  default: 20,
};

export default function WeekDetailPage() {
  const { n } = useParams();
  const week = parseInt(n || "1", 10);
  const meta = WEEK_META.find((w) => w.week === week);
  const quests = useLiveQuery(() => db.quests.where("week").equals(week).toArray(), [week]);
  const { profile, updateProfile, refreshProfile } = useProfile();

  if (!meta || !profile) return null;

  const questsByDay = new Map<number, Quest[]>();
  (quests || []).forEach((q) => {
    const arr = questsByDay.get(q.day) || [];
    arr.push(q);
    questsByDay.set(q.day, arr);
  });

  const completeQuest = async (q: Quest) => {
    if (q.completedAt) return;
    await db.quests.update(q.id, { completedAt: new Date().toISOString() });
    // Grant XP
    await updateProfile({ xp: profile.xp + q.xp });
    const streakPatch = await logStudySession(profile, {
      minutes: QUEST_MINUTES[q.type] ?? QUEST_MINUTES.default,
      questsCompleted: 1,
    });
    if (Object.keys(streakPatch).length > 0) {
      await updateProfile(streakPatch);
    }
    // Haptic on mobile
    if ("vibrate" in navigator) navigator.vibrate(10);

    pushToast({
      variant: "success",
      icon: "✅",
      title: "Quest complete",
      body: q.title,
      xp: q.xp,
      durationMs: 2800,
    });

    await checkAchievements({ kind: "quest-complete", questId: q.id, week: q.week, day: q.day });
    await refreshProfile();
  };

  const undoQuest = async (q: Quest) => {
    if (!q.completedAt) return;
    await db.quests.update(q.id, { completedAt: null });
    await updateProfile({ xp: Math.max(0, profile.xp - q.xp) });
  };

  const dayNumbers = [1, 2, 3, 4, 5, 6, 7];

  return (
    <div className="page">
      <div className="flex items-center justify-between mb-2 no-print">
        <div className="flex items-center gap-2 text-sm text-dim">
          <Link to="/plan" className="link">← 8-Week Plan</Link>
          <span>/</span>
          <span>Week {week}</span>
        </div>
        <button
          onClick={() => window.print()}
          className="btn-ghost text-xs"
          aria-label={`Print Week ${week} summary`}
        >
          <span aria-hidden="true">🖨️ </span>Print
        </button>
      </div>
      <h1 className="text-2xl font-bold">{meta.title}</h1>
      <p className="text-dim mt-1 mb-4">{meta.focus}</p>
      {meta.target && (
        <div className="card mb-4 border-warn/40 bg-warn/5">
          <p className="text-sm">🎯 <span className="font-semibold">Target:</span> {meta.target}</p>
        </div>
      )}

      {(quests || []).length === 0 && (
        <EmptyState
          icon="📅"
          title="No quests for this week yet"
          body="The quest library is seeded on first launch. Reset from Settings if this looks empty by mistake."
          action={{ kind: "link", to: "/plan", label: "Back to Campaign" }}
        />
      )}

      <div className="space-y-4">
        {dayNumbers.map((day) => {
          const dayQuests = questsByDay.get(day) || [];
          if (dayQuests.length === 0) return null;
          const dayComplete = dayQuests.every((q) => q.completedAt);

          return (
            <div key={day} className="card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">Day {day}</h3>
                {dayComplete && <span className="pill bg-high/15 text-high">✓ Complete</span>}
              </div>
              <ul className="space-y-2" role="list">
                {dayQuests.map((q) => (
                  <li
                    key={q.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                      q.completedAt
                        ? "bg-high/5 border-high/30"
                        : "bg-panel2 border-border hover:border-accent/40"
                    }`}
                  >
                    <button
                      onClick={() => (q.completedAt ? undoQuest(q) : completeQuest(q))}
                      role="checkbox"
                      aria-checked={!!q.completedAt}
                      aria-label={`${q.title}. ${q.completedAt ? "Completed" : "Not completed"}. Worth ${q.xp} XP.`}
                      className={`w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                        q.completedAt
                          ? "bg-high border-high text-bg"
                          : "border-border hover:border-accent"
                      }`}
                    >
                      <span aria-hidden="true">{q.completedAt && "✓"}</span>
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium ${q.completedAt ? "line-through text-dim" : ""}`}>
                        {q.title}
                      </p>
                      <p className="text-sm text-dim mt-0.5">{q.description}</p>
                      <div className="flex gap-1 mt-2 flex-wrap" aria-hidden="true">
                        <span className="chip">{q.type}</span>
                        <span className="chip bg-xp/15 text-xp">+{q.xp} XP</span>
                        {q.domainIds.length > 0 && q.domainIds.length <= 3 && (
                          <span className="chip">D{q.domainIds.join(",")}</span>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
