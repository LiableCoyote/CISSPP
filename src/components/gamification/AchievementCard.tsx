import { format, parseISO } from "date-fns";
import { TIER_STYLES, type AchievementDef } from "../../data/achievements";

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
  const tier = TIER_STYLES[def.tier];

  return (
    // min-w-0 is required: as a grid child this box defaults to min-width:auto,
    // which stops the truncating text below from ever shrinking.
    // Locked cards fade only the decorative icon — fading the whole card composited
    // the small chip text down to a 2.29:1 contrast ratio.
    <div
      className={`card p-3 flex items-center gap-3 min-w-0 ${
        earned ? `${tier.ring} border` : "bg-panel/40"
      }`}
    >
      <span
        className={`text-2xl leading-none shrink-0 ${earned ? "" : "opacity-40 grayscale"}`}
        aria-hidden="true"
      >
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
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span
          className={`chip text-[10px] ${tier.bg} ${tier.text}`}
          title={`${def.tier} difficulty`}
        >
          {def.tier}
        </span>
        {earned ? (
          def.xp > 0 && <span className="chip bg-xp/15 text-xp text-[10px]">+{def.xp}</span>
        ) : (
          <span className="chip bg-panel2 text-dim text-[10px]">Locked</span>
        )}
      </div>
    </div>
  );
}
