import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/schema";
import { DOMAINS } from "../../data/domains";
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
} from "recharts";
import { format, subDays, parseISO } from "date-fns";

export default function StatsPage() {
  const attempts = useLiveQuery(() => db.attempts.orderBy("startedAt").toArray()) || [];
  const studyLog = useLiveQuery(() => db.studyLog.toArray()) || [];
  const answers = useLiveQuery(() => db.answers.toArray()) || [];

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
    return { id: d.id, name: d.name, mastery: Math.round(avg), weight: d.weight, accent: d.accent, priority: d.priority };
  });

  const weakest = [...domainMastery].filter((d) => d.mastery > 0).sort((a, b) => a.mastery - b.mastery).slice(0, 2);

  // CISO thinking score
  const totalAnswered = answers.length;
  const mindsetMisses = answers.filter((a) => a.flaggedMindset).length;
  const cisoScore = totalAnswered > 0 ? Math.round(((totalAnswered - mindsetMisses) / totalAnswered) * 100) : 100;

  return (
    <div className="page">
      <h1 className="text-2xl font-bold mb-6">Your Stats</h1>

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

      {/* Weakest domains */}
      {weakest.length > 0 && (
        <div className="card mb-6 border-warn/40 bg-warn/5">
          <h3 className="font-semibold mb-3">Weakest Domains</h3>
          {weakest.map((d) => (
            <div key={d.id} className="flex items-center justify-between mb-2 last:mb-0">
              <span className="text-sm">D{d.id} · {d.name}</span>
              <span className="text-sm font-bold text-warn">{d.mastery}%</span>
            </div>
          ))}
          <p className="text-xs text-dim mt-2">These need targeted drill sessions this week.</p>
        </div>
      )}

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
    </div>
  );
}
