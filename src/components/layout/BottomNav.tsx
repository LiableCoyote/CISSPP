import { NavLink, useNavigate } from "react-router-dom";
import { useState } from "react";

const TABS = [
  { to: "/", label: "Home", icon: "◆" },
  { to: "/plan", label: "Plan", icon: "🗓" },
  { to: "/flashcards", label: "Cards", icon: "🃏" },
  { to: "/quiz", label: "Quiz", icon: "🎯" },
];

const MORE_ITEMS = [
  { to: "/domains", label: "Domains", icon: "🧭" },
  { to: "/vault", label: "Vault", icon: "🏛️" },
  { to: "/stats", label: "Stats", icon: "📊" },
  { to: "/resources", label: "Resources", icon: "📚" },
  { to: "/settings", label: "Settings", icon: "⚙️" },
];

export default function BottomNav() {
  const [moreOpen, setMoreOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <>
      {/* Bottom nav — mobile only */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-panel/95 backdrop-blur border-t border-border safe-bottom">
        <div className="grid grid-cols-5 h-16">
          {TABS.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.to === "/"}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-0.5 min-h-[48px] text-[10px] font-medium transition-colors ${
                  isActive ? "text-accent" : "text-dim hover:text-ink active:text-accent"
                }`
              }
            >
              <span className="text-lg" aria-hidden>
                {t.icon}
              </span>
              <span>{t.label}</span>
            </NavLink>
          ))}
          <button
            aria-label="Open more menu"
            onClick={() => setMoreOpen(true)}
            className="flex flex-col items-center justify-center gap-0.5 min-h-[48px] text-[10px] font-medium text-dim hover:text-ink active:text-accent"
          >
            <span className="text-lg" aria-hidden>
              ≡
            </span>
            <span>More</span>
          </button>
        </div>
      </nav>

      {/* More menu — bottom sheet */}
      {moreOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/60"
          onClick={() => setMoreOpen(false)}
        >
          <div
            className="absolute bottom-0 inset-x-0 bg-panel border-t border-border rounded-t-2xl p-4 safe-bottom animate-[slideup_0.2s_ease-out]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-1 bg-border rounded-full mx-auto mb-3" />
            <h3 className="text-lg font-semibold mb-3">More</h3>
            <div className="grid grid-cols-2 gap-2">
              {MORE_ITEMS.map((item) => (
                <button
                  key={item.to}
                  onClick={() => {
                    setMoreOpen(false);
                    navigate(item.to);
                  }}
                  className="list-row justify-start text-left"
                >
                  <span className="text-xl" aria-hidden>
                    {item.icon}
                  </span>
                  <span className="font-medium">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
