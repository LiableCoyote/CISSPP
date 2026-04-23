import { NavLink, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";

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
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFocusRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMoreOpen(false);
        triggerRef.current?.focus();
      }
      // Simple focus trap: cycle through buttons inside dialog on Tab
      if (e.key === "Tab" && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!first || !last) return;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    // Move focus into the dialog
    firstFocusRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [moreOpen]);

  return (
    <>
      <nav
        aria-label="Primary mobile navigation"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-panel/95 backdrop-blur border-t border-border safe-bottom"
      >
        <ul className="grid grid-cols-5 h-16" role="list">
          {TABS.map((t) => (
            <li key={t.to} role="listitem">
              <NavLink
                to={t.to}
                end={t.to === "/"}
                aria-label={t.label}
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center gap-0.5 min-h-[48px] h-full text-[10px] font-medium transition-colors ${
                    isActive ? "text-accent" : "text-dim hover:text-ink active:text-accent"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && <span className="sr-only">Current page: </span>}
                    <span className="text-lg" aria-hidden="true">
                      {t.icon}
                    </span>
                    <span aria-hidden="true">{t.label}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
          <li role="listitem">
            <button
              ref={triggerRef}
              aria-label="Open more navigation menu"
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
              onClick={() => setMoreOpen(true)}
              className="w-full flex flex-col items-center justify-center gap-0.5 min-h-[48px] h-full text-[10px] font-medium text-dim hover:text-ink active:text-accent"
            >
              <span className="text-lg" aria-hidden="true">
                ≡
              </span>
              <span aria-hidden="true">More</span>
            </button>
          </li>
        </ul>
      </nav>

      {moreOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/60"
          onClick={() => setMoreOpen(false)}
          role="presentation"
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="more-menu-title"
            className="absolute bottom-0 inset-x-0 bg-panel border-t border-border rounded-t-2xl p-4 safe-bottom"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-1 bg-border rounded-full mx-auto mb-3" aria-hidden="true" />
            <h2 id="more-menu-title" className="text-lg font-semibold mb-3">
              More
            </h2>
            <ul className="grid grid-cols-2 gap-2" role="list">
              {MORE_ITEMS.map((item, i) => (
                <li key={item.to} role="listitem">
                  <button
                    ref={i === 0 ? firstFocusRef : null}
                    onClick={() => {
                      setMoreOpen(false);
                      navigate(item.to);
                    }}
                    className="list-row w-full justify-start text-left"
                  >
                    <span className="text-xl" aria-hidden="true">
                      {item.icon}
                    </span>
                    <span className="font-medium">{item.label}</span>
                  </button>
                </li>
              ))}
            </ul>
            <button
              onClick={() => {
                setMoreOpen(false);
                triggerRef.current?.focus();
              }}
              className="btn-ghost w-full mt-3"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
