import { useLiveQuery } from "dexie-react-hooks";
import { Link } from "react-router-dom";
import { db } from "../../db/schema";
import { DOMAINS } from "../../data/domains";
import EmptyState from "../../components/ui/EmptyState";
import SessionTimeline from "./SessionTimeline";
import MasteryTrend from "./MasteryTrend";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar,
} from "recharts";
import { format, subDays, parseISO, addDays, differenceInCalendarDays } from "date-fns";
import { calibrationCurve, confidentMisses, type ConfidenceLevel } from "../../lib/calibration";
import { pacingStats, describePacing, EXAM_BUDGET_SECONDS } from "../../lib/pacing";

/** The same wording the quiz picker uses, so the two screens agree. */
const CONFIDENCE_LABELS: Record<ConfidenceLevel, string> = {
  1: "Guessing", 2: "Unsure", 3: "Leaning", 4: "Confident", 5: "Certain",
};

export default function StatsPage() {
  const attempts = useLiveQuery(() => db.attempts.orderBy("startedAt").toArray()) || [];
  const studyLog = useLiveQuery(() => db.studyLog.toArray()) || [];
  const answers = useLiveQuery(() => db.answers.toArray()) || [];
  const flashcards = useLiveQuery(() => db.flashcards.toArray()) || [];

  // Study heatmap — last 90 days
  const today = new Date();
  const days: { date: string; minutes: number }[] = [];
  for (let i = 89; i >= 0; i--) {
    const d = subDays(today, i);
    const key = format(d, "yyyy-MM-dd");
    const log = studyLog.find((l) => l.date === key);
    days.push({ date: key, minutes: log?.minutes || 0 });
  }

  const heatColor = (mins: number) => {
    if (mins === 0) return "bg-panel2";
    if (mins < 30) return "bg-accent/20";
    if (mins < 60) return "bg-accent/40";
    if (mins < 120) return "bg-accent/70";
    return "bg-accent";
  };

  // Score trend
  const scoreData = attempts
    .filter((a) => a.finishedAt)
    .map((a) => ({
      date: format(parseISO(a.startedAt), "MM/dd"),
      score: a.scorePct,
      mode: a.mode,
    }));

  // Miss categories
  const missCats = { mindset: 0, knowledge: 0, misread: 0, unlabeled: 0 };
  answers.forEach((a) => {
    if (a.correct) return;
    if (a.missCategory) missCats[a.missCategory]++;
    else missCats.unlabeled++;
  });
  const pieData = [
    { name: "Mindset", value: missCats.mindset, color: "#fbbf24" },
    { name: "Knowledge", value: missCats.knowledge, color: "#38bdf8" },
    { name: "Misread", value: missCats.misread, color: "#f87171" },
    { name: "Unlabeled", value: missCats.unlabeled, color: "#8b97ab" },
  ].filter((d) => d.value > 0);

  // Domain mastery
  const domainMastery = DOMAINS.map((d) => {
    const domainAttempts = attempts.filter((a) => a.domainId === d.id);
    const avg = domainAttempts.length > 0
      ? domainAttempts.reduce((s, a) => s + a.scorePct, 0) / domainAttempts.length
      : 0;
    return {
      id: d.id,
      name: d.name,
      mastery: Math.round(avg),
      attempts: domainAttempts.length,
      weight: d.weight,
      accent: d.accent,
      priority: d.priority,
    };
  });

  const weakest = [...domainMastery].filter((d) => d.mastery > 0).sort((a, b) => a.mastery - b.mastery).slice(0, 2);
  // Actionable banner: domains with ≥2 attempts sitting below 60%.
  const remediation = domainMastery.filter((d) => d.attempts >= 2 && d.mastery < 60);

  // 7-day flashcard due forecast
  const srsForecast = Array.from({ length: 8 }, (_, i) => {
    const day = addDays(today, i);
    const label = i === 0 ? "Today" : format(day, "EEE");
    const dueOn = flashcards.filter((c) => {
      const diff = differenceInCalendarDays(parseISO(c.dueAt), today);
      return diff === i;
    }).length;
    const overdue = i === 0 ? flashcards.filter((c) => parseISO(c.dueAt) < today).length : 0;
    return { day: label, due: dueOn + overdue };
  });

  // CISO thinking score
  const totalAnswered = answers.length;
  const mindsetMisses = answers.filter((a) => a.flaggedMindset).length;
  const cisoScore = totalAnswered > 0 ? Math.round(((totalAnswered - mindsetMisses) / totalAnswered) * 100) : 100;

  // Confidence and timing were both already recorded on every answer; until now
  // nothing read them beyond a single counter.
  const calibration = calibrationCurve(answers);
  const confident = confidentMisses(answers);
  const pacing = pacingStats(answers);
  const pacingNote = describePacing(pacing);

  const hasAnyData = attempts.length > 0 || studyLog.length > 0;

  return (
    <div className="page">
      <div className="flex items-center justify-between gap-2 mb-6">
        <h1 className="text-2xl font-bold">Your Stats</h1>
        <Link to="/report" className="btn-ghost text-xs shrink-0">
          <span aria-hidden="true">📄 </span>Export report
        </Link>
      </div>

      {!hasAnyData && (
        <EmptyState
          icon="📊"
          title="No study data yet"
          body="Complete a quest or take a quiz and your heatmap, score trend, and mastery chart will populate automatically."
          action={{ kind: "link", to: "/plan", label: "Open Campaign" }}
        />
      )}

      {hasAnyData && (<>
      {/* Heatmap */}
      <div className="card mb-6">
        <h3 className="font-semibold mb-3">90-Day Study Heatmap</h3>
        <div className="grid grid-flow-col grid-rows-7 gap-1 overflow-x-auto no-scrollbar">
          {days.map((d) => (
            <div
              key={d.date}
              title={`${d.date}: ${d.minutes} min`}
              className={`w-3 h-3 rounded-sm ${heatColor(d.minutes)}`}
            />
          ))}
        </div>
        <div className="flex items-center justify-between mt-3 text-xs text-dim">
          <span>Less</span>
          <div className="flex gap-1">
            <div className="w-3 h-3 rounded-sm bg-panel2" />
            <div className="w-3 h-3 rounded-sm bg-accent/20" />
            <div className="w-3 h-3 rounded-sm bg-accent/40" />
            <div className="w-3 h-3 rounded-sm bg-accent/70" />
            <div className="w-3 h-3 rounded-sm bg-accent" />
          </div>
          <span>More</span>
        </div>
      </div>

      {/* Session timeline */}
      <SessionTimeline studyLog={studyLog} attempts={attempts} />

      {/* CISO score */}
      <div className="card mb-6 border-accent/40 bg-accent/5">
        <h3 className="font-semibold mb-1">CISO Thinking Score</h3>
        <p className="text-3xl font-bold text-accent">{cisoScore}%</p>
        <p className="text-xs text-dim mt-1">
          {cisoScore >= 85
            ? "Think like a CISO — keep it up."
            : cisoScore >= 70
            ? "Improving. Keep choosing governance over technical fixes."
            : "Watch for the technician trap. Re-read questions for BEST/FIRST/MOST."}
        </p>
      </div>

      {/* Weak-domain remediation banner */}
      {remediation.length > 0 && (
        <div className="card mb-6 border-danger/40 bg-danger/5" role="note">
          <h3 className="font-semibold mb-2">
            <span aria-hidden="true">🚨 </span>Remediation Needed
          </h3>
          <p className="text-xs text-dim mb-3">
            Domains averaging below 60% after 2+ attempts. Drill these first.
          </p>
          <div className="space-y-2">
            {remediation.map((d) => (
              <Link
                key={d.id}
                to={`/quiz/session?mode=domain&domain=${d.id}`}
                className="flex items-center justify-between p-2 rounded-lg bg-panel2 hover:bg-border transition-colors"
              >
                <div>
                  <span className="text-sm font-medium">D{d.id} · {d.name}</span>
                  <span className="text-xs text-dim ml-2">
                    ({d.attempts} attempt{d.attempts === 1 ? "" : "s"})
                  </span>
                </div>
                <span className="text-sm font-bold text-danger">
                  {d.mastery}% <span aria-hidden="true">→</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Weakest domains (summary) */}
      {weakest.length > 0 && remediation.length === 0 && (
        <div className="card mb-6 border-warn/40 bg-warn/5">
          <h3 className="font-semibold mb-3">Weakest Domains</h3>
          {weakest.map((d) => (
            <div key={d.id} className="flex items-center justify-between mb-2 last:mb-0">
              <span className="text-sm">D{d.id} · {d.name}</span>
              <span className="text-sm font-bold text-warn">{d.mastery}%</span>
            </div>
          ))}
          <p className="text-xs text-dim mt-2">Rotate some drill time through these this week.</p>
        </div>
      )}

      {/* 7-day flashcard due forecast */}
      {flashcards.length > 0 && (
        <div className="card mb-6">
          <h3 className="font-semibold mb-3">Flashcards Due — Next 7 Days</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={srsForecast}>
              <CartesianGrid strokeDasharray="3 3" stroke="#243046" />
              <XAxis dataKey="day" stroke="#8b97ab" fontSize={11} />
              <YAxis stroke="#8b97ab" fontSize={11} allowDecimals={false} />
              <Tooltip contentStyle={{ background: "#111827", border: "1px solid #243046" }} />
              <Bar dataKey="due" fill="#fbbf24" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs text-dim mt-1">
            Today's bar includes overdue cards. Chip away so you don't get buried.
          </p>
        </div>
      )}

      {/* Per-domain learning curves */}
      <MasteryTrend attempts={attempts} />

      {/* Score trend */}
      {scoreData.length > 0 && (
        <div className="card mb-6">
          <h3 className="font-semibold mb-3">Score Trend</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={scoreData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#243046" />
              <XAxis dataKey="date" stroke="#8b97ab" fontSize={11} />
              <YAxis domain={[0, 100]} stroke="#8b97ab" fontSize={11} />
              <Tooltip contentStyle={{ background: "#111827", border: "1px solid #243046" }} />
              <ReferenceLine y={70} stroke="#fbbf24" strokeDasharray="3 3" label={{ value: "Week 6 target", fill: "#fbbf24", fontSize: 10 }} />
              <ReferenceLine y={75} stroke="#22c55e" strokeDasharray="3 3" label={{ value: "Week 7 target", fill: "#22c55e", fontSize: 10 }} />
              <Line type="monotone" dataKey="score" stroke="#6ee7b7" strokeWidth={2} dot={{ fill: "#6ee7b7" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Confidence calibration */}
      <section aria-labelledby="calibration-heading" className="card mb-6">
        <h3 id="calibration-heading" className="font-semibold mb-1">Confidence Calibration</h3>
        <p className="text-xs text-dim mb-3">
          Are you right as often as you think you are? Being wrong is survivable — not
          knowing which answers to double-check is not.
        </p>

        {calibration.insufficient ? (
          // Deliberately no chart. A calibration curve drawn from a handful of
          // answers invites a study decision the data cannot support.
          <p className="text-sm text-dim">
            Rate your confidence on a few more questions — {calibration.rated} of{" "}
            {calibration.needed} so far. Below that there isn't enough to read anything into.
          </p>
        ) : (
          <>
            <div className="flex items-baseline gap-2 mb-3 flex-wrap">
              <span
                className={`text-2xl font-bold ${
                  calibration.verdict === "well-calibrated" ? "text-high" : "text-warn"
                }`}
              >
                {calibration.verdict === "well-calibrated"
                  ? "Well calibrated"
                  : calibration.verdict === "overconfident"
                    ? "Overconfident"
                    : "Underconfident"}
              </span>
              <span className="text-xs text-dim">
                across {calibration.rated} rated answers
              </span>
            </div>

            <ul className="space-y-2" role="list">
              {calibration.buckets
                .filter((b) => b.count > 0)
                .map((b) => (
                  <li key={b.confidence}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span>
                        {CONFIDENCE_LABELS[b.confidence]}{" "}
                        <span className="text-dim text-xs">({b.count})</span>
                      </span>
                      <span className={b.reliable ? "font-semibold" : "text-dim"}>
                        {b.reliable ? `${b.accuracyPct}% right` : "too few to say"}
                      </span>
                    </div>
                    {b.reliable && (
                      <div
                        className="h-2 bg-panel2 rounded-full overflow-hidden"
                        role="img"
                        aria-label={`Rated ${CONFIDENCE_LABELS[b.confidence]}: ${b.accuracyPct}% correct, against about ${b.expectedPct}% claimed`}
                      >
                        <div
                          className={`h-full ${b.gap > 15 ? "bg-danger" : b.gap > 0 ? "bg-warn" : "bg-high"}`}
                          style={{ width: `${b.accuracyPct}%` }}
                        />
                      </div>
                    )}
                  </li>
                ))}
            </ul>

            {confident.confident > 0 && (
              <p className="text-sm mt-3 text-dim">
                You were sure (4–5) on {confident.confident} answers and wrong on{" "}
                <span className={confident.wrong > 0 ? "text-danger font-semibold" : ""}>
                  {confident.wrong}
                </span>{" "}
                of them. Those are your highest-signal review targets.
              </p>
            )}
          </>
        )}
      </section>

      {/* Pacing against the real exam budget */}
      <section aria-labelledby="pacing-heading" className="card mb-6">
        <h3 id="pacing-heading" className="font-semibold mb-1">Pacing</h3>
        <p className="text-xs text-dim mb-3">
          The exam gives 150 questions in 180 minutes — about {EXAM_BUDGET_SECONDS}s each.
        </p>

        {pacingNote === null ? (
          <p className="text-sm text-dim">
            Answer a few more questions and your pace will show up here.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="text-center">
                <p className="text-xs text-dim">Median</p>
                <p className="text-xl font-bold">{pacing.medianSeconds}s</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-dim">When right</p>
                <p className="text-xl font-bold text-high">{pacing.medianCorrectSeconds}s</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-dim">When wrong</p>
                <p className="text-xl font-bold text-danger">{pacing.medianIncorrectSeconds}s</p>
              </div>
            </div>
            <p className={`text-sm ${pacing.overBudget ? "text-warn" : "text-dim"}`}>
              {pacingNote}
            </p>
            {pacing.discarded > 0 && (
              <p className="text-xs text-dim mt-2">
                {pacing.discarded} answer{pacing.discarded === 1 ? "" : "s"} over 10 minutes
                excluded as walked-away.
              </p>
            )}
          </>
        )}
      </section>

      {/* Miss category pie */}
      {pieData.length > 0 && (
        <div className="card mb-6">
          <h3 className="font-semibold mb-3">Miss Categories</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70}>
                {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "#111827", border: "1px solid #243046" }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Domain mastery list */}
      <div className="card">
        <h3 className="font-semibold mb-3">Domain Mastery</h3>
        <div className="space-y-2">
          {domainMastery.map((d) => (
            <div key={d.id}>
              <div className="flex items-center justify-between text-sm mb-1">
                <span>D{d.id} {d.priority === "HIGH" && "🔥"}</span>
                <span className="font-semibold">{d.mastery}%</span>
              </div>
              <div className="h-2 bg-panel2 rounded-full overflow-hidden">
                <div
                  className="h-full transition-all"
                  style={{ width: `${d.mastery}%`, backgroundColor: d.accent }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
      </>)}
    </div>
  );
}
