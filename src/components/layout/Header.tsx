import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useProfile } from "../../state/profile";
import { xpToLevel } from "../../lib/xp";
import { daysUntilExam } from "../../lib/campaign";

export default function Header() {
  const { profile } = useProfile();
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  if (!profile) return null;

  const { level, levelTitle } = xpToLevel(profile.xp);
  // Shared helper so this agrees with the Dashboard, which is often on screen
  // at the same time — the two used different rounding and could disagree.
  const daysLeft = daysUntilExam(profile) ?? 0;

  return (
    <header
      role="banner"
      className="sticky top-0 z-30 bg-bg/80 backdrop-blur border-b border-border safe-top"
    >
      <div className="max-w-6xl mx-auto flex items-center justify-between px-4 md:px-8 h-14">
        <Link to="/" className="flex items-center gap-2 font-bold text-lg" aria-label="CISSPP home">
          <span className="text-accent" aria-hidden="true">◆</span>
          <span className="hidden sm:inline">CISSPP</span>
        </Link>
        <div
          className="flex items-center gap-2 text-sm"
          role="status"
          aria-live="polite"
          aria-atomic="false"
        >
          <button
            onClick={() => (window as Window & { __cisspp_openSearch?: () => void }).__cisspp_openSearch?.()}
            className="pill bg-panel2 text-dim hover:text-ink flex items-center gap-1"
            aria-label="Open search (Ctrl+K)"
            aria-keyshortcuts="Control+K"
          >
            <span aria-hidden="true">🔎</span>
            <kbd className="text-[10px] hidden md:inline">⌘K</kbd>
          </button>
          {!online && (
            <span className="pill bg-warn/20 text-warn" role="alert">
              <span className="sr-only">Status: </span>Offline
            </span>
          )}
          <span className="pill bg-panel2 text-dim hidden sm:inline-flex">
            <span className="sr-only">Level </span>L{level}
            <span className="sr-only">, </span>
            <span aria-hidden="true"> · </span>
            {levelTitle}
          </span>
          <span className="pill bg-accent/15 text-accent font-semibold" aria-label={`${profile.streak} day streak`}>
            <span aria-hidden="true">🔥 </span>
            {profile.streak}
          </span>
          <span className="pill bg-xp/15 text-xp font-semibold hidden sm:inline-flex" aria-label={`${profile.xp} experience points`}>
            <span aria-hidden="true">⚡ </span>
            {profile.xp} XP
          </span>
          <span
            className="pill bg-accent2/15 text-accent2 font-semibold"
            aria-label={daysLeft > 0 ? `${daysLeft} days until exam` : "Exam day"}
          >
            {daysLeft > 0 ? `${daysLeft}d` : "Exam!"}
          </span>
        </div>
      </div>
    </header>
  );
}
