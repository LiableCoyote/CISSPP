import { useLiveQuery } from "dexie-react-hooks";
import { Link } from "react-router-dom";
import { db } from "../../db/schema";
import { WEEK_META } from "../../data/weeks";

export default function CampaignPage() {
  const allQuests = useLiveQuery(() => db.quests.toArray()) || [];

  return (
    <div className="page">
      <h1 className="text-2xl font-bold mb-2">8-Week Campaign</h1>
      <p className="text-dim text-sm mb-6">Every day is a quest. Every week is a chapter. Finish the campaign, pass the exam.</p>

      <div className="space-y-3">
        {WEEK_META.map((w) => {
          const weekQuests = allQuests.filter((q) => q.week === w.week);
          const completed = weekQuests.filter((q) => q.completedAt).length;
          const total = weekQuests.length || 1;
          const pct = Math.round((completed / total) * 100);

          return (
            <Link
              key={w.week}
              to={`/plan/week/${w.week}`}
              className="card card-hover block"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-accent/15 text-accent flex items-center justify-center font-bold shrink-0">
                  {w.week}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h3 className="font-semibold">{w.title}</h3>
                    {w.isBossWeek && (
                      <span className="pill bg-danger/15 text-danger">
                        {w.bossKind === "full-exam" ? "🐉 Boss Exam" : "⚔️ Week Quiz"}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-dim mt-1">{w.focus}</p>
                  {w.target && (
                    <p className="text-xs text-warn mt-1">🎯 {w.target}</p>
                  )}
                  <div className="mt-3 h-2 bg-panel2 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-accent to-accent2 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-xs text-dim mt-1">
                    {completed}/{total} quests · {pct}%
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
