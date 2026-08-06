import { useState } from "react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { QuizAttempt, StudyDay } from "../../db/schema";
import { buildTimeline, describeStudyPattern } from "../../lib/analytics";

const WINDOWS = [14, 30, 90] as const;

export default function SessionTimeline({
  studyLog,
  attempts,
}: {
  studyLog: StudyDay[];
  attempts: QuizAttempt[];
}) {
  const [windowDays, setWindowDays] = useState<(typeof WINDOWS)[number]>(30);

  const timeline = buildTimeline(studyLog, attempts, windowDays);
  const pattern = describeStudyPattern(timeline);

  const activeDays = timeline.filter((d) => d.minutes > 0 || d.quizzes > 0);
  const totalMinutes = timeline.reduce((s, d) => s + d.minutes, 0);
  const totalQuizzes = timeline.reduce((s, d) => s + d.quizzes, 0);
  const totalCards = timeline.reduce((s, d) => s + d.flashcardsReviewed, 0);

  if (activeDays.length === 0) return null;

  return (
    <div className="card mb-6">
      <div className="flex items-center justify-between mb-3 gap-2">
        <h3 className="font-semibold">Study Timeline</h3>
        <div className="flex gap-1" role="group" aria-label="Timeline range">
          {WINDOWS.map((w) => (
            <button
              key={w}
              onClick={() => setWindowDays(w)}
              aria-pressed={windowDays === w}
              className={`chip text-[11px] px-2 py-1 border transition-colors ${
                windowDays === w
                  ? "bg-accent/15 text-accent border-accent/40"
                  : "bg-panel2 text-dim border-transparent hover:text-ink"
              }`}
            >
              {w}d
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={timeline} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#243046" />
          <XAxis
            dataKey="label"
            stroke="#8b97ab"
            fontSize={10}
            interval={Math.max(0, Math.floor(timeline.length / 7) - 1)}
          />
          <YAxis yAxisId="left" stroke="#8b97ab" fontSize={10} allowDecimals={false} />
          <YAxis
            yAxisId="right"
            orientation="right"
            domain={[0, 100]}
            stroke="#6ee7b7"
            fontSize={10}
            width={32}
          />
          <Tooltip
            contentStyle={{ background: "#111827", border: "1px solid #243046", fontSize: 12 }}
            formatter={(value, name) => [value, name === "avgScore" ? "Avg score %" : "Minutes"]}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar
            yAxisId="left"
            dataKey="minutes"
            name="Minutes"
            fill="#38bdf8"
            radius={[3, 3, 0, 0]}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="avgScore"
            name="Avg score"
            stroke="#6ee7b7"
            strokeWidth={2}
            dot={{ r: 2, fill: "#6ee7b7" }}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>

      <div className="grid grid-cols-4 gap-2 mt-3 text-center">
        <div>
          <p className="text-lg font-bold">{activeDays.length}</p>
          <p className="text-[10px] text-dim uppercase tracking-wide">Active days</p>
        </div>
        <div>
          <p className="text-lg font-bold">{Math.round(totalMinutes / 60)}h</p>
          <p className="text-[10px] text-dim uppercase tracking-wide">Studied</p>
        </div>
        <div>
          <p className="text-lg font-bold">{totalQuizzes}</p>
          <p className="text-[10px] text-dim uppercase tracking-wide">Quizzes</p>
        </div>
        <div>
          <p className="text-lg font-bold">{totalCards}</p>
          <p className="text-[10px] text-dim uppercase tracking-wide">Cards</p>
        </div>
      </div>

      {pattern && <p className="text-xs text-dim mt-3 border-t border-border pt-3">{pattern}</p>}
    </div>
  );
}
