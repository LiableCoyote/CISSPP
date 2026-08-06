import { useState, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/schema";
import {
  ACHIEVEMENT_DEFS,
  ACHIEVEMENT_CATEGORIES,
  type AchievementCategory,
} from "../../data/achievements";
import AchievementCard from "../../components/gamification/AchievementCard";

type Filter = "all" | "unlocked" | "locked";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unlocked", label: "Unlocked" },
  { key: "locked", label: "Locked" },
];

export default function AchievementsPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const unlocks = useLiveQuery(() => db.achievements.toArray());

  const unlockedAtById = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of unlocks || []) map.set(u.id, u.unlockedAt);
    return map;
  }, [unlocks]);

  // Dexie hasn't resolved yet — hold the render rather than flash "0 unlocked".
  if (!unlocks) return null;

  const total = ACHIEVEMENT_DEFS.length;
  const unlockedCount = ACHIEVEMENT_DEFS.filter((d) => unlockedAtById.has(d.id)).length;
  const pct = total > 0 ? Math.round((unlockedCount / total) * 100) : 0;

  const xpEarned = ACHIEVEMENT_DEFS.filter((d) => unlockedAtById.has(d.id)).reduce((s, d) => s + d.xp, 0);
  const xpAvailable = ACHIEVEMENT_DEFS.reduce((s, d) => s + d.xp, 0);

  const recent = [...(unlocks || [])]
    .sort((a, b) => b.unlockedAt.localeCompare(a.unlockedAt))
    .slice(0, 3)
    .map((u) => ACHIEVEMENT_DEFS.find((d) => d.id === u.id))
    .filter((d): d is (typeof ACHIEVEMENT_DEFS)[number] => !!d);

  const visible = ACHIEVEMENT_DEFS.filter((d) => {
    if (filter === "unlocked") return unlockedAtById.has(d.id);
    if (filter === "locked") return !unlockedAtById.has(d.id);
    return true;
  });

  // Group by category, then sort unlocked-first inside each group so progress reads top-down.
  const byCategory = ACHIEVEMENT_CATEGORIES.map((cat: AchievementCategory) => {
    const defs = visible
      .filter((d) => d.category === cat)
      .sort((a, b) => {
        const aU = unlockedAtById.get(a.id);
        const bU = unlockedAtById.get(b.id);
        if (aU && bU) return bU.localeCompare(aU);
        if (aU) return -1;
        if (bU) return 1;
        return 0;
      });
    const catTotal = ACHIEVEMENT_DEFS.filter((d) => d.category === cat).length;
    const catUnlocked = ACHIEVEMENT_DEFS.filter(
      (d) => d.category === cat && unlockedAtById.has(d.id),
    ).length;
    return { cat, defs, catTotal, catUnlocked };
  }).filter((g) => g.defs.length > 0);

  return (
    <div className="page">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Achievements</h1>
        <p className="text-sm text-dim mt-1">
          {unlockedCount === total
            ? "Every badge earned. Go pass the exam."
            : "Badges unlock as you study. No grinding required — they follow the plan."}
        </p>
      </div>

      {/* Collection progress */}
      <div className="card mb-4">
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-sm font-semibold">
            {unlockedCount} / {total} Unlocked
          </span>
          <span className="text-sm text-accent font-bold">{pct}%</span>
        </div>
        <div
          className="h-2.5 bg-panel2 rounded-full overflow-hidden"
          role="progressbar"
          aria-label="Achievement collection progress"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuetext={`${unlockedCount} of ${total} achievements unlocked`}
        >
          <div
            className="h-full bg-gradient-to-r from-xp to-accent2 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-xs text-dim mt-2">
          <span className="text-xp font-semibold">{xpEarned} XP</span> earned from achievements ·{" "}
          {xpAvailable - xpEarned} XP still on the table
        </p>
      </div>

      {/* Most recent unlocks */}
      {recent.length > 0 && (
        <section aria-labelledby="recent-unlocks" className="mb-6">
          <h2 id="recent-unlocks" className="text-lg font-semibold mb-3">
            <span aria-hidden="true">🆕 </span>Recently Unlocked
          </h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {recent.map((def) => (
              <AchievementCard
                key={def.id}
                def={def}
                unlockedAt={unlockedAtById.get(def.id)}
                showDetail
              />
            ))}
          </div>
        </section>
      )}

      {/* Filters */}
      <div className="flex gap-2 mb-4" role="group" aria-label="Filter achievements">
        {FILTERS.map((f) => {
          const count =
            f.key === "all" ? total : f.key === "unlocked" ? unlockedCount : total - unlockedCount;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              aria-pressed={filter === f.key}
              className={`chip text-xs px-3 py-1.5 transition-colors ${
                filter === f.key
                  ? "bg-accent/15 text-accent border border-accent/40"
                  : "bg-panel2 text-dim border border-transparent hover:text-ink"
              }`}
            >
              {f.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Grouped list */}
      {byCategory.length === 0 ? (
        <div className="card text-center py-8">
          <p className="text-3xl mb-2" aria-hidden="true">
            {filter === "unlocked" ? "🔒" : "🎉"}
          </p>
          <p className="text-sm text-dim">
            {filter === "unlocked"
              ? "Nothing unlocked yet. Finish a quiz to draw first blood."
              : "Everything is unlocked. Nothing left to chase."}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {byCategory.map(({ cat, defs, catTotal, catUnlocked }) => (
            <section key={cat} aria-labelledby={`cat-${cat.replace(/\s/g, "-")}`}>
              <div className="flex items-baseline justify-between mb-3">
                <h2 id={`cat-${cat.replace(/\s/g, "-")}`} className="text-lg font-semibold">
                  {cat}
                </h2>
                <span className="text-xs text-dim">
                  {catUnlocked} / {catTotal}
                </span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {defs.map((def) => (
                  <AchievementCard
                    key={def.id}
                    def={def}
                    unlockedAt={unlockedAtById.get(def.id)}
                    showDetail
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
