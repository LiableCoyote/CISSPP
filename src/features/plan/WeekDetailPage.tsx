import { useParams, Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Quest } from "../../db/schema";
import { WEEK_META } from "../../data/weeks";
import { useProfile } from "../../state/profile";
import { format } from "date-fns";

export default function WeekDetailPage() {
  const { n } = useParams();
  const week = parseInt(n || "1", 10);
  const meta = WEEK_META.find((w) => w.week === week);
  const quests = useLiveQuery(() => db.quests.where("week").equals(week).toArray(), [week]);
  const { profile, updateProfile } = useProfile();

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
    // Log study minutes (estimate from quest type)
    const minutes =
      q.type === "watch" ? 25 : q.type === "read" ? 20 : q.type === "quiz" ? 35 : q.type === "exam" ? 180 : q.type === "flashcards" ? 15 : 20;
    const today = format(new Date(), "yyyy-MM-dd");
    const existing = await db.studyLog.get(today);
    if (existing) {
      await db.studyLog.update(today, {
        minutes: existing.minutes + minutes,
        questsCompleted: existing.questsCompleted + 1,
      });
    } else {
      await db.studyLog.add({
        date: today,
        minutes,
        sessions: 1,
        questsCompleted: 1,
        flashcardsReviewed: 0,
      });
    }
    // Update streak if not already active today
    const lastActive = profile.lastActiveDate;
    if (lastActive !== today) {
      const yesterday = format(new Date(Date.now() - 86400000), "yyyy-MM-dd");
      const newStreak = lastActive === yesterday ? profile.streak + 1 : 1;
      await updateProfile({
        lastActiveDate: today,
        streak: newStreak,
        longestStreak: Math.max(profile.longestStreak, newStreak),
      });
    }
    // Haptic on mobile
    if ("vibrate" in navigator) navigator.vibrate(10);
  };

  const undoQuest = async (q: Quest) => {
    if (!q.completedAt) return;
    await db.quests.update(q.id, { completedAt: null });
    await updateProfile({ xp: Math.max(0, profile.xp - q.xp) });
  };

  const dayNumbers = [1, 2, 3, 4, 5, 6, 7];

  return (
    <div className="page">
      <div className="flex items-center gap-2 text-sm text-dim mb-2">
        <Link to="/plan" className="link">← 8-Week Plan</Link>
        <span>/</span>
        <span>Week {week}</span>
      </div>
      <h1 className="text-2xl font-bold">{meta.title}</h1>
      <p className="text-dim mt-1 mb-4">{meta.focus}</p>
      {meta.target && (
        <div className="card mb-4 border-warn/40 bg-warn/5">
          <p className="text-sm">🎯 <span className="font-semibold">Target:</span> {meta.target}</p>
        </div>
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
