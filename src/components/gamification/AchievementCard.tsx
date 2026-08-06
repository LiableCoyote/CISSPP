import { format, parseISO } from "date-fns";
import type { AchievementDef } from "../../data/achievements";

export default function AchievementCard({
  def,
  unlockedAt,
  showDetail = false,
}: {
  def: AchievementDef;
  unlockedAt?: string | null;
  /** Adds the unlock date (earned) or the how-to-earn hint (locked). */
  showDetail?: boolean;
}) {
  const earned = !!unlockedAt;
  const detail = earned
    ? unlockedAt
      ? `Unlocked ${format(parseISO(unlockedAt), "MMM d, yyyy")}`
      : null
    : def.hint;

  return (
    <div
      className={`card p-3 flex items-center gap-3 ${earned ? "border-xp/40" : "opacity-50"}`}
    >
      <span className="text-2xl leading-none shrink-0" aria-hidden="true">
        {def.icon}
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate">{def.name}</p>
        <p className="text-xs text-dim truncate">{def.description}</p>
        {showDetail && detail && (
          <p className={`text-[11px] mt-1 truncate ${earned ? "text-xp" : "text-dim/70"}`}>
            {earned ? <span aria-hidden="true">✓ </span> : <span aria-hidden="true">→ </span>}
            {detail}
          </p>
        )}
      </div>
      {earned ? (
        <span className="chip bg-xp/15 text-xp text-[10px] shrink-0">+{def.xp}</span>
      ) : (
        <span className="chip bg-panel2 text-dim text-[10px] shrink-0">Locked</span>
      )}
    </div>
  );
}
