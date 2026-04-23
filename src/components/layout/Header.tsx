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
    <header className="sticky top-0 z-30 bg-bg/80 backdrop-blur border-b border-border safe-top">
      <div className="max-w-6xl mx-auto flex items-center justify-between px-4 md:px-8 h-14">
        <Link to="/" className="flex items-center gap-2 font-bold text-lg">
          <span className="text-accent">◆</span>
          <span className="hidden sm:inline">CISSPP</span>
        </Link>
        <div className="flex items-center gap-2 text-sm">
          {!online && (
            <span className="pill bg-warn/20 text-warn">Offline</span>
          )}
          <span className="pill bg-panel2 text-dim hidden sm:inline-flex">
            L{level} · {levelTitle}
          </span>
          <span className="pill bg-accent/15 text-accent font-semibold">
            🔥 {profile.streak}
          </span>
          <span className="pill bg-xp/15 text-xp font-semibold hidden sm:inline-flex">
            ⚡ {profile.xp} XP
          </span>
          <span className="pill bg-accent2/15 text-accent2 font-semibold">
            {daysUntilExam > 0 ? `${daysUntilExam}d` : "Exam!"}
          </span>
        </div>
      </div>
    </header>
  );
}
