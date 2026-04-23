import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useProfile } from "../../state/profile";
import { xpToLevel } from "../../lib/xp";

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
  const daysUntilExam = profile.examDate
    ? Math.ceil((new Date(profile.examDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    : 0;

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
            aria-label={daysUntilExam > 0 ? `${daysUntilExam} days until exam` : "Exam day"}
          >
            {daysUntilExam > 0 ? `${daysUntilExam}d` : "Exam!"}
          </span>
        </div>
      </div>
    </header>
  );
}
