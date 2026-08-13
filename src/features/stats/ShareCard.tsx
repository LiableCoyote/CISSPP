import { useRef, useState } from "react";
import { toPng } from "html-to-image";
import { differenceInCalendarDays, parseISO, format } from "date-fns";
import { useProfile } from "../../state/profile";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/schema";
import { DOMAINS } from "../../data/domains";
import { xpToLevel } from "../../lib/xp";
import { pushToast } from "../../state/toast";
import { buildWeeklySummary, weeklyHeadline } from "../../lib/analytics";

/** Renders "+12" / "−4" / "even" for a week-over-week change. */
function Delta({ value, unit }: { value: number; unit: string }) {
  const color = value > 0 ? "#6ee7b7" : value < 0 ? "#f87171" : "#556076";
  const text = value === 0 ? "even" : `${value > 0 ? "+" : "−"}${Math.abs(value)} ${unit}`;
  return (
    <span className="text-[10px]" style={{ color }}>
      {text}
    </span>
  );
}

export default function ShareCard() {
  const { profile } = useProfile();
  const attempts = useLiveQuery(() => db.attempts.toArray());
  const studyLog = useLiveQuery(() => db.studyLog.toArray());
  const unlocks = useLiveQuery(() => db.achievements.toArray());
  const cardRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  // Hold the render until Dexie resolves. Defaulting these to [] rendered a card
  // reading "Quiet week" with every bar at 0%, and the export button was live —
  // one quick click produced a PNG that misstated the user's actual progress.
  if (!profile || !attempts || !studyLog || !unlocks) return null;

  const week = buildWeeklySummary({
    studyLog,
    attempts,
    unlockedAt: unlocks.map((u) => u.unlockedAt),
  });
  const headline = weeklyHeadline(week, profile.streak);

  const today = new Date();
  const daysUntilExam = profile.examDate
    ? differenceInCalendarDays(parseISO(profile.examDate), today)
    : null;
  const { level, levelTitle } = xpToLevel(profile.xp);

  const domainAvgs = DOMAINS.map((d) => {
    const ds = attempts.filter((a) => a.domainId === d.id);
    const avg = ds.length > 0 ? Math.round(ds.reduce((s, a) => s + a.scorePct, 0) / ds.length) : 0;
    return { id: d.id, accent: d.accent, avg };
  });

  const handleExport = async () => {
    if (!cardRef.current) return;
    setExporting(true);
    try {
      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#0a0e1a",
      });
      const link = document.createElement("a");
      link.download = `cisspp-progress-${format(today, "yyyy-MM-dd")}.png`;
      link.href = dataUrl;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      link.remove();
      pushToast({ variant: "success", icon: "📸", title: "Share card saved", durationMs: 2500 });
    } catch (err) {
      console.error("Share card export failed:", err);
      pushToast({ variant: "warn", icon: "⚠️", title: "Couldn't generate the image" });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="card mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">
          <span aria-hidden="true">📸 </span>Share progress
        </h3>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="btn-ghost text-xs disabled:opacity-60"
        >
          {exporting ? "Rendering…" : "Download PNG"}
        </button>
      </div>

      <div
        ref={cardRef}
        className="rounded-xl p-6"
        style={{ background: "linear-gradient(145deg, #0a0e1a 0%, #111827 100%)", color: "#e6eefc" }}
      >
        <p className="text-xs uppercase tracking-[0.2em]" style={{ color: "#8b97ab" }}>
          CISSPP · {profile.displayName}
        </p>
        <p className="text-3xl font-bold mt-2" style={{ color: "#6ee7b7" }}>
          Level {level}
        </p>
        <p className="text-sm" style={{ color: "#a78bfa" }}>
          {levelTitle}
        </p>

        <div className="grid grid-cols-3 gap-3 mt-5 text-center">
          <div>
            <p className="text-[10px] uppercase tracking-wider" style={{ color: "#8b97ab" }}>
              Streak
            </p>
            <p className="text-2xl font-bold" style={{ color: "#fb923c" }}>
              🔥 {profile.streak}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider" style={{ color: "#8b97ab" }}>
              XP
            </p>
            <p className="text-2xl font-bold" style={{ color: "#fbbf24" }}>
              {profile.xp}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider" style={{ color: "#8b97ab" }}>
              Days Left
            </p>
            <p className="text-2xl font-bold" style={{ color: "#38bdf8" }}>
              {daysUntilExam ?? "—"}
            </p>
          </div>
        </div>

        {/* Last 7 days, with week-over-week movement */}
        <div className="mt-5">
          <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: "#8b97ab" }}>
            This Week
          </p>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-lg font-bold" style={{ color: "#e6eefc" }}>
                {week.minutes}m
              </p>
              <Delta value={week.minutesDelta} unit="min" />
            </div>
            <div>
              <p className="text-lg font-bold" style={{ color: "#e6eefc" }}>
                {week.quizzes}
              </p>
              <Delta value={week.quizzesDelta} unit="quiz" />
            </div>
            <div>
              <p className="text-lg font-bold" style={{ color: "#e6eefc" }}>
                {week.cards}
              </p>
              <Delta value={week.cardsDelta} unit="cards" />
            </div>
          </div>
          {week.avgScore !== null && (
            <p className="text-[10px] mt-2 text-center" style={{ color: "#8b97ab" }}>
              Avg score {week.avgScore}%
              {week.scoreDelta !== null && (
                <>
                  {" · "}
                  <span style={{ color: week.scoreDelta >= 0 ? "#6ee7b7" : "#f87171" }}>
                    {week.scoreDelta >= 0 ? "▲" : "▼"} {Math.abs(week.scoreDelta)} pts vs last week
                  </span>
                </>
              )}
            </p>
          )}
        </div>

        <div className="mt-5">
          <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: "#8b97ab" }}>
            Domain Mastery
          </p>
          <div className="space-y-1.5">
            {domainAvgs.map((d) => (
              <div key={d.id} className="flex items-center gap-2">
                <span className="text-[10px] font-mono w-6" style={{ color: "#e6eefc" }}>
                  D{d.id}
                </span>
                <div className="flex-1 h-1.5 rounded-full" style={{ background: "#1f2937" }}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${d.avg}%`, background: d.accent }}
                  />
                </div>
                <span className="text-[10px] font-mono w-8 text-right" style={{ color: "#8b97ab" }}>
                  {d.avg}%
                </span>
              </div>
            ))}
          </div>
        </div>

        <p
          className="text-[11px] mt-5 pt-3 italic"
          style={{ color: "#a78bfa", borderTop: "1px solid #1f2937" }}
        >
          {headline}
        </p>
        <p className="text-[10px] mt-2 text-right" style={{ color: "#556076" }}>
          {format(today, "MMM d, yyyy")}
        </p>
      </div>
    </div>
  );
}
