import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { db } from "../../db/schema";
import { useProfile } from "../../state/profile";
import { DOMAINS } from "../../data/domains";
import { ACHIEVEMENT_DEFS } from "../../data/achievements";
import { WEEK_META } from "../../data/weeks";
import { xpToLevel } from "../../lib/xp";
import { buildWeeklySummary } from "../../lib/analytics";

const RECENT_ATTEMPT_LIMIT = 20;

/**
 * Print-optimised study summary. Rendered as a route rather than a modal
 * because the print stylesheet hides [role="dialog"] — the browser's
 * print-to-PDF is the export path, so no PDF dependency is needed.
 */
export default function StudyReportPage() {
  const { profile } = useProfile();
  const attempts = useLiveQuery(() => db.attempts.toArray());
  const quests = useLiveQuery(() => db.quests.toArray());
  const studyLog = useLiveQuery(() => db.studyLog.toArray());
  const unlocks = useLiveQuery(() => db.achievements.toArray());
  const flashcards = useLiveQuery(() => db.flashcards.toArray());

  if (!profile || !attempts || !quests || !studyLog || !unlocks || !flashcards) return null;

  const today = new Date();
  const finished = attempts.filter((a) => a.finishedAt);
  const daysUntilExam = profile.examDate
    ? differenceInCalendarDays(parseISO(profile.examDate), today)
    : null;
  const { level, levelTitle } = xpToLevel(profile.xp);

  const totalMinutes = studyLog.reduce((s, d) => s + d.minutes, 0);
  const activeDays = studyLog.filter((d) => d.minutes > 0).length;
  const totalCards = studyLog.reduce((s, d) => s + d.flashcardsReviewed, 0);

  const week = buildWeeklySummary({
    studyLog,
    attempts,
    unlockedAt: unlocks.map((u) => u.unlockedAt),
  });

  const domainRows = DOMAINS.map((d) => {
    const ds = finished.filter((a) => a.domainId === d.id);
    const avg = ds.length > 0 ? Math.round(ds.reduce((s, a) => s + a.scorePct, 0) / ds.length) : null;
    return { ...d, avg, attempts: ds.length };
  });

  const weekRows = WEEK_META.map((w) => {
    const wq = quests.filter((q) => q.week === w.week);
    const done = wq.filter((q) => q.completedAt).length;
    return { week: w.week, title: w.title, done, total: wq.length };
  });

  const unlockedDefs = unlocks
    .map((u) => ({ def: ACHIEVEMENT_DEFS.find((d) => d.id === u.id), unlockedAt: u.unlockedAt }))
    .filter((x): x is { def: (typeof ACHIEVEMENT_DEFS)[number]; unlockedAt: string } => !!x.def)
    .sort((a, b) => a.unlockedAt.localeCompare(b.unlockedAt));

  const recent = [...finished]
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .slice(0, RECENT_ATTEMPT_LIMIT);

  const overallAvg =
    finished.length > 0
      ? Math.round(finished.reduce((s, a) => s + a.scorePct, 0) / finished.length)
      : null;

  const cardsStarted = flashcards.filter((c) => c.reps > 0).length;

  return (
    <div className="page">
      <div className="flex items-start justify-between gap-2 mb-6 no-print">
        <div>
          <h1 className="text-2xl font-bold">Study Report</h1>
          <p className="text-sm text-dim mt-1">
            Print or save as PDF from your browser's print dialog.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Link to="/stats" className="btn-ghost text-xs">
            ← Stats
          </Link>
          <button onClick={() => window.print()} className="btn-primary text-xs">
            <span aria-hidden="true">🖨️ </span>Print / Save PDF
          </button>
        </div>
      </div>

      {/* Header */}
      <div className="card mb-4">
        <div className="flex items-baseline justify-between flex-wrap gap-2">
          <h2 className="text-xl font-bold">CISSP Study Report</h2>
          <span className="text-xs text-dim">Generated {format(today, "MMMM d, yyyy")}</span>
        </div>
        <p className="text-sm text-dim mt-1">
          {profile.displayName} · Level {level} · {levelTitle}
          {profile.examDate && (
            <>
              {" · Exam "}
              {format(parseISO(profile.examDate), "MMM d, yyyy")}
              {daysUntilExam !== null && ` (${daysUntilExam} days)`}
            </>
          )}
        </p>
      </div>

      {/* Headline numbers */}
      <div className="card mb-4">
        <h3 className="font-semibold mb-3">At a Glance</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          {[
            { label: "Total XP", value: profile.xp.toLocaleString() },
            { label: "Current streak", value: `${profile.streak}d` },
            { label: "Longest streak", value: `${profile.longestStreak}d` },
            { label: "Hours studied", value: `${Math.round(totalMinutes / 60)}h` },
            { label: "Active days", value: activeDays },
            { label: "Quizzes taken", value: finished.length },
            { label: "Overall average", value: overallAvg !== null ? `${overallAvg}%` : "—" },
            { label: "Cards reviewed", value: totalCards },
          ].map((s) => (
            <div key={s.label}>
              <p className="text-xl font-bold">{s.value}</p>
              <p className="text-[10px] text-dim uppercase tracking-wide">{s.label}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-dim mt-3 border-t border-border pt-3">
          Last 7 days: {week.minutes} minutes, {week.quizzes} quizzes, {week.cards} cards
          {week.avgScore !== null && `, ${week.avgScore}% average`}. Deck coverage:{" "}
          {cardsStarted} of {flashcards.length} cards started.
        </p>
      </div>

      {/* Campaign progress */}
      <div className="card mb-4">
        <h3 className="font-semibold mb-3">Campaign Progress</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-1.5 text-xs uppercase tracking-wider text-dim font-medium">Week</th>
              <th className="text-left py-1.5 text-xs uppercase tracking-wider text-dim font-medium">Focus</th>
              <th className="text-right py-1.5 text-xs uppercase tracking-wider text-dim font-medium">Quests</th>
            </tr>
          </thead>
          <tbody>
            {weekRows.map((w) => (
              <tr key={w.week} className="border-b border-border/50 last:border-0">
                <td className="py-1.5 font-semibold">{w.week}</td>
                <td className="py-1.5 text-dim">{w.title}</td>
                <td className="py-1.5 text-right tabular-nums">
                  {w.done} / {w.total}
                  {w.total > 0 && w.done === w.total && <span aria-hidden="true"> ✓</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Domain mastery */}
      <div className="card mb-4">
        <h3 className="font-semibold mb-3">Domain Mastery</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-1.5 text-xs uppercase tracking-wider text-dim font-medium">Domain</th>
              <th className="text-right py-1.5 text-xs uppercase tracking-wider text-dim font-medium">Weight</th>
              <th className="text-right py-1.5 text-xs uppercase tracking-wider text-dim font-medium">Attempts</th>
              <th className="text-right py-1.5 text-xs uppercase tracking-wider text-dim font-medium">Average</th>
            </tr>
          </thead>
          <tbody>
            {domainRows.map((d) => (
              <tr key={d.id} className="border-b border-border/50 last:border-0">
                <td className="py-1.5">
                  <span className="font-semibold">D{d.id}</span>{" "}
                  <span className="text-dim">{d.name}</span>
                </td>
                <td className="py-1.5 text-right text-dim tabular-nums">{d.weight}%</td>
                <td className="py-1.5 text-right text-dim tabular-nums">{d.attempts}</td>
                <td
                  className={`py-1.5 text-right font-semibold tabular-nums ${
                    d.avg === null ? "text-dim" : d.avg >= 70 ? "text-high" : d.avg >= 60 ? "text-warn" : "text-danger"
                  }`}
                >
                  {d.avg === null ? "—" : `${d.avg}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-dim mt-2">
          Untested domains show "—". A domain needs at least two attempts before the average means
          much.
        </p>
      </div>

      {/* Quiz history */}
      {recent.length > 0 && (
        <div className="card mb-4">
          <h3 className="font-semibold mb-3">
            Recent Quiz History
            {finished.length > RECENT_ATTEMPT_LIMIT && (
              <span className="text-xs text-dim font-normal">
                {" "}
                — most recent {RECENT_ATTEMPT_LIMIT} of {finished.length}
              </span>
            )}
          </h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-1.5 text-xs uppercase tracking-wider text-dim font-medium">Date</th>
                <th className="text-left py-1.5 text-xs uppercase tracking-wider text-dim font-medium">Mode</th>
                <th className="text-right py-1.5 text-xs uppercase tracking-wider text-dim font-medium">Questions</th>
                <th className="text-right py-1.5 text-xs uppercase tracking-wider text-dim font-medium">Score</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((a) => (
                <tr key={a.id} className="border-b border-border/50 last:border-0">
                  <td className="py-1.5 text-dim">{format(parseISO(a.startedAt), "MMM d")}</td>
                  <td className="py-1.5">
                    {a.mode === "domain" && a.domainId ? `Domain ${a.domainId}` : a.mode === "full" ? "Full exam" : "Mixed"}
                  </td>
                  <td className="py-1.5 text-right text-dim tabular-nums">{a.questionIds.length}</td>
                  <td
                    className={`py-1.5 text-right font-semibold tabular-nums ${
                      a.scorePct >= 70 ? "text-high" : a.scorePct >= 60 ? "text-warn" : "text-danger"
                    }`}
                  >
                    {a.scorePct}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Achievements */}
      <div className="card">
        <h3 className="font-semibold mb-3">
          Achievements
          <span className="text-xs text-dim font-normal">
            {" "}
            — {unlockedDefs.length} of {ACHIEVEMENT_DEFS.length}
          </span>
        </h3>
        {unlockedDefs.length === 0 ? (
          <p className="text-sm text-dim">None unlocked yet.</p>
        ) : (
          <ul className="space-y-1.5" role="list">
            {unlockedDefs.map(({ def, unlockedAt }) => (
              <li key={def.id} className="flex items-center gap-2 text-sm">
                <span aria-hidden="true">{def.icon}</span>
                <span className="flex-1 min-w-0 truncate">
                  <span className="font-medium">{def.name}</span>{" "}
                  <span className="text-dim text-xs">· {def.tier}</span>
                </span>
                <span className="text-xs text-dim whitespace-nowrap">
                  {format(parseISO(unlockedAt), "MMM d")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
