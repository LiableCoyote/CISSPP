import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/schema";
import { useProfile } from "../../state/profile";
import { campaignPosition, domainsMastered } from "../../lib/campaign";
import {
  PACE_ARCHETYPES,
  PACE_METRICS,
  paceValueAt,
  type PaceMetric,
} from "../../data/pacing";

type Row = {
  id: string;
  name: string;
  icon: string;
  blurb: string;
  value: number;
  isYou: boolean;
};

export default function PaceBoardPage() {
  const [metric, setMetric] = useState<PaceMetric>("xp");
  const { profile } = useProfile();
  const attempts = useLiveQuery(() => db.attempts.toArray());
  const unlockCount = useLiveQuery(() => db.achievements.count());

  if (!profile || attempts === undefined || unlockCount === undefined) return null;

  const { week: currentWeek } = campaignPosition(profile);
  const mastered = domainsMastered(attempts);

  const yourValue: Record<PaceMetric, number> = {
    xp: profile.xp,
    streak: profile.streak,
    domains: mastered,
    achievements: unlockCount,
  };

  const rows: Row[] = [
    ...PACE_ARCHETYPES.map((a) => ({
      id: a.id,
      name: a.name,
      icon: a.icon,
      blurb: a.blurb,
      value: paceValueAt(a, metric, currentWeek),
      isYou: false,
    })),
    {
      id: "you",
      name: profile.displayName || "You",
      icon: "⭐",
      blurb: `Week ${currentWeek} of the campaign.`,
      value: yourValue[metric],
      isYou: true,
    },
  ].sort((a, b) => b.value - a.value);

  const yourRank = rows.findIndex((r) => r.isYou) + 1;
  const max = Math.max(1, ...rows.map((r) => r.value));
  const unit = PACE_METRICS.find((m) => m.key === metric)!.unit;

  // The next pace above you is the useful target, not the top of the board.
  const ahead = rows[yourRank - 2];

  return (
    <div className="page">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Pace Board</h1>
        <p className="text-sm text-dim mt-1">
          Where you sit against reference study paces at Week {currentWeek}.
        </p>
      </div>

      {/* This is the honest framing — these are targets, not people. */}
      <div className="card mb-4 border-accent/40 bg-accent/5">
        <p className="text-xs text-dim">
          <span className="font-semibold text-accent">
            <span aria-hidden="true">ℹ️ </span>These aren't other users.
          </span>{" "}
          CISSPP is offline and single-user — there's no one to rank against. Each row is a named
          study pace with a defined weekly rate, scaled to how far you are into the 8-week campaign.
        </p>
      </div>

      {/* Metric tabs */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 mb-4" role="tablist" aria-label="Metric">
        {PACE_METRICS.map((m) => (
          <button
            key={m.key}
            role="tab"
            aria-selected={metric === m.key}
            onClick={() => setMetric(m.key)}
            className={`chip text-xs px-3 py-1.5 whitespace-nowrap shrink-0 border transition-colors ${
              metric === m.key
                ? "bg-accent/15 text-accent border-accent/40"
                : "bg-panel2 text-dim border-transparent hover:text-ink"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Your standing */}
      <div className="card mb-4 text-center">
        <p className="text-xs text-dim uppercase tracking-wider">Your position</p>
        <p className="text-4xl font-bold text-accent mt-1">
          #{yourRank}
          <span className="text-lg text-dim font-normal"> of {rows.length}</span>
        </p>
        <p className="text-sm text-dim mt-2">
          {ahead
            ? `${ahead.value - rows[yourRank - 1].value} ${unit} behind ${ahead.name}.`
            : "You're ahead of every reference pace on this metric."}
        </p>
      </div>

      <ol className="space-y-2" role="list">
        {rows.map((r, i) => (
          <li
            key={r.id}
            className={`card p-3 ${r.isYou ? "border-accent bg-accent/5 border-2" : ""}`}
          >
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-dim w-6 shrink-0 tabular-nums">{i + 1}</span>
              <span className="text-xl shrink-0" aria-hidden="true">
                {r.icon}
              </span>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold truncate ${r.isYou ? "text-accent" : ""}`}>
                  {r.name}
                  {r.isYou && <span className="text-[10px] text-dim font-normal ml-2">you</span>}
                </p>
                <p className="text-xs text-dim truncate">{r.blurb}</p>
              </div>
              <span className="text-sm font-bold tabular-nums shrink-0">
                {r.value.toLocaleString()}
              </span>
            </div>
            <div className="h-1.5 bg-panel2 rounded-full overflow-hidden mt-2">
              <div
                className={`h-full rounded-full transition-all ${
                  r.isYou ? "bg-gradient-to-r from-xp to-accent2" : "bg-border"
                }`}
                style={{ width: `${(r.value / max) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
