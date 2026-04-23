import { NavLink } from "react-router-dom";
import { useProfile } from "../../state/profile";
import { xpToLevel, LEVEL_XP_THRESHOLDS } from "../../lib/xp";

const ITEMS = [
  { to: "/", label: "Dashboard", icon: "◆" },
  { to: "/plan", label: "8-Week Plan", icon: "🗓" },
  { to: "/flashcards", label: "Flashcards", icon: "🃏" },
  { to: "/quiz", label: "Quiz", icon: "🎯" },
  { to: "/domains", label: "Domains", icon: "🧭" },
  { to: "/vault", label: "Vault", icon: "🏛️" },
  { to: "/stats", label: "Stats", icon: "📊" },
  { to: "/resources", label: "Resources", icon: "📚" },
  { to: "/settings", label: "Settings", icon: "⚙️" },
];

export default function Sidebar() {
  const { profile } = useProfile();

  if (!profile) return null;

  const { level, levelTitle, xpInLevel } = xpToLevel(profile.xp);
  const nextThreshold = LEVEL_XP_THRESHOLDS[Math.min(level + 1, LEVEL_XP_THRESHOLDS.length - 1)];
  const levelBaseXp = LEVEL_XP_THRESHOLDS[level];
  const levelRange = nextThreshold - levelBaseXp;
  const progress = levelRange > 0 ? Math.min(100, (xpInLevel / levelRange) * 100) : 100;

  return (
    <aside className="hidden md:flex flex-col w-60 h-screen sticky top-0 border-r border-border bg-panel/40 p-4">
      <div className="flex items-center gap-2 font-bold text-xl mb-6">
        <span className="text-accent text-2xl">◆</span>
        CISSPP
      </div>

      <nav className="flex flex-col gap-1 flex-1">
        {ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg font-medium text-sm transition-colors ${
                isActive
                  ? "bg-accent/15 text-accent"
                  : "text-dim hover:bg-panel2 hover:text-ink"
              }`
            }
          >
            <span className="text-base" aria-hidden>
              {item.icon}
            </span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="pt-4 border-t border-border">
        <div className="text-xs text-dim mb-1">Lvl {level} · {levelTitle}</div>
        <div className="h-2 bg-panel2 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-xp to-accent2 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between mt-1 text-xs text-dim">
          <span>{profile.xp} XP</span>
          <span>🔥 {profile.streak}</span>
        </div>
      </div>
    </aside>
  );
}
