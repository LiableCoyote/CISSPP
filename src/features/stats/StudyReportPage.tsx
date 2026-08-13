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
import { describeMode } from "../../lib/scoring";
import { readiness, projectReadiness, coverageByDomain } from "../../lib/readiness";
import { calibrationCurve, confidentMisses } from "../../lib/calibration";
import { pacingStats, describePacing, EXAM_BUDGET_SECONDS } from "../../lib/pacing";

const RECENT_ATTEMPT_LIMIT = 20;

const READINESS_LABEL = {
  "on-track": "On track",
  borderline: "Borderline",
  "not-ready": "Not ready yet",
} as const;

const CONFIDENCE_LABEL = {
  1: "Guessing", 2: "Unsure", 3: "Leaning", 4: "Confident", 5: "Certain",
} as const;

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
  const answers = useLiveQuery(() => db.answers.toArray());
  const questionDomains = useLiveQuery(async () => {
    const rows = await db.questions.toArray();
    return new Map(rows.map((q) => [q.id, q.domainId as number]));
  });

  if (!profile || !attempts || !quests || !studyLog || !unlocks || !flashcards) return null;
  if (!answers || !questionDomains) return null;

  const today = new Date();
  const finished = attempts.filter((a) => a.finishedAt);
  const daysUntilExam = profile.examDate
    ? differenceInCalendarDays(parseISO(profile.examDate), today)
    : null;
  const { level, levelTitle } = xpToLevel(profile.xp);

  const ready = readiness(attempts, coverageByDomain(answers, (id) => questionDomains.get(id)));
  const projection = projectReadiness(attempts, profile.examDate);
  const calibration = calibrationCurve(answers);
  const confident = confidentMisses(answers);
  const pacing = pacingStats(answers);
  const pacingNote = describePacing(pacing);

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

      {/* Readiness — first, because it is the number the report exists to answer.
          The caveats print with it, never without: this is the version of the
          report that gets shown to other people, so an unqualified percentage
          would travel further than the qualification. */}
      <div className="card mb-4">
        <h3 className="font-semibold mb-3">Exam Readiness</h3>
        <div className="flex items-baseline gap-3 flex-wrap">
          <p className="text-3xl font-bold tabular-nums">{ready.scorePct}%</p>
          <p className="text-sm">
            <span className="font-semibold">{READINESS_LABEL[ready.band]}</span>
            <span className="text-dim"> · exam-weighted · {ready.confidence} confidence</span>
          </p>
        </div>
        {projection && (
          <p className="text-sm mt-2">
            At the last two weeks' rate ({projection.perDay > 0 ? "+" : ""}
            {projection.perDay} pts/day) that trend reaches{" "}
            <span className="font-semibold">{projection.projectedPct}%</span> in{" "}
            {projection.daysRemaining} days — a straight line through recent scores, not a
            forecast.
          </p>
        )}
        <ul className="mt-3 space-y-1" role="list">
          {ready.caveats.map((c) => (
            <li key={c} className="text-xs text-dim flex gap-2">
              <span aria-hidden="true" className="shrink-0">·</span>
              <span>{c}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Calibration and pacing */}
      <div className="card mb-4">
        <h3 className="font-semibold mb-3">Calibration &amp; Pacing</h3>

        {calibration.insufficient ? (
          // Refuses on paper for the same reason it refuses on screen: a curve
          // drawn from a handful of answers reads as settled once printed.
          <p className="text-sm text-dim">
            Confidence calibration needs {calibration.needed} rated answers — {calibration.rated} so
            far, so no curve is shown.
          </p>
        ) : (
          <>
            <p className="text-sm mb-2">
              <span className="font-semibold">
                {calibration.verdict === "well-calibrated"
                  ? "Well calibrated"
                  : calibration.verdict === "overconfident"
                    ? "Overconfident"
                    : "Underconfident"}
              </span>
              <span className="text-dim"> across {calibration.rated} rated answers.</span>
              {confident.confident > 0 && (
                <span className="text-dim">
                  {" "}
                  Sure on {confident.confident}, wrong on {confident.wrong} of them.
                </span>
              )}
            </p>
            <table className="w-full text-sm mb-3">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-1.5 text-xs uppercase tracking-wider text-dim font-medium">Rated</th>
                  <th className="text-right py-1.5 text-xs uppercase tracking-wider text-dim font-medium">Answers</th>
                  <th className="text-right py-1.5 text-xs uppercase tracking-wider text-dim font-medium">Correct</th>
                </tr>
              </thead>
              <tbody>
                {calibration.buckets
                  .filter((b) => b.count > 0)
                  .map((b) => (
                    <tr key={b.confidence} className="border-b border-border/50 last:border-0">
                      <td className="py-1.5">{CONFIDENCE_LABEL[b.confidence]}</td>
                      <td className="py-1.5 text-right text-dim tabular-nums">{b.count}</td>
                      <td className="py-1.5 text-right font-semibold tabular-nums">
                        {b.reliable ? `${b.accuracyPct}%` : "too few"}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </>
        )}

        {pacingNote === null ? (
          <p className="text-sm text-dim">
            Not enough answered questions yet to report a pace.
          </p>
        ) : (
          <p className="text-sm">
            <span className="font-semibold">
              {pacing.medianSeconds}s median
            </span>
            <span className="text-dim">
              {" "}
              ({pacing.medianCorrectSeconds}s when right, {pacing.medianIncorrectSeconds}s when
              wrong) against the {EXAM_BUDGET_SECONDS}s exam budget. {pacingNote}
            </span>
          </p>
        )}
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
                    {describeMode(a.mode, a.domainId)}
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
