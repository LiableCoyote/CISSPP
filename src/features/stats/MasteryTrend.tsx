import { Link } from "react-router-dom";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import type { QuizAttempt } from "../../db/schema";
import { buildMasteryTrend, buildDomainVelocity } from "../../lib/analytics";

export default function MasteryTrend({ attempts }: { attempts: QuizAttempt[] }) {
  const trend = buildMasteryTrend(attempts);
  const velocity = buildDomainVelocity(attempts);

  // One line per domain that has been attempted at all.
  const tracked = velocity.filter((v) => v.attempts > 0);
  const moved = velocity
    .filter((v) => v.attempts > 0 && v.previous > 0)
    .sort((a, b) => b.delta - a.delta);
  const stagnant = velocity.filter((v) => v.stagnant);

  // A single point is not a curve.
  if (trend.length < 2 || tracked.length === 0) return null;

  return (
    <div className="card mb-6">
      <h3 className="font-semibold mb-1">Domain Learning Curves</h3>
      <p className="text-xs text-dim mb-3">
        Running average per domain. Flat lines mean drilling isn't landing.
      </p>

      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={trend} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#243046" />
          <XAxis
            dataKey="label"
            stroke="#8b97ab"
            fontSize={10}
            interval={Math.max(0, Math.floor(trend.length / 6) - 1)}
          />
          <YAxis domain={[0, 100]} stroke="#8b97ab" fontSize={10} />
          <Tooltip
            contentStyle={{ background: "#111827", border: "1px solid #243046", fontSize: 12 }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <ReferenceLine
            y={60}
            stroke="#f87171"
            strokeDasharray="3 3"
            label={{ value: "Remediation line", fill: "#f87171", fontSize: 9, position: "insideBottomRight" }}
          />
          {tracked.map((v) => (
            <Line
              key={v.id}
              type="monotone"
              dataKey={`d${v.id}`}
              name={`D${v.id}`}
              stroke={v.accent}
              strokeWidth={2}
              dot={{ r: 2 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      {/* 7-day movement */}
      {moved.length > 0 && (
        <div className="mt-4 border-t border-border pt-3">
          <h4 className="text-xs uppercase tracking-wider text-dim mb-2">7-Day Movement</h4>
          <ul className="space-y-1.5" role="list">
            {moved.map((v) => (
              <li key={v.id} className="flex items-center justify-between text-sm">
                <span className="truncate mr-2">
                  D{v.id} · <span className="text-dim">{v.name}</span>
                </span>
                <span className="flex items-center gap-2 shrink-0">
                  <span className="text-dim text-xs">{v.current}%</span>
                  <span
                    className={`font-semibold text-xs tabular-nums ${
                      v.delta > 0 ? "text-high" : v.delta < 0 ? "text-danger" : "text-dim"
                    }`}
                  >
                    {v.delta > 0 ? "▲" : v.delta < 0 ? "▼" : "—"}{" "}
                    {v.delta === 0 ? "flat" : `${Math.abs(v.delta)} pt`}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {stagnant.length > 0 && (
        <div className="mt-3 rounded-lg bg-warn/5 border border-warn/40 p-3" role="note">
          <p className="text-xs">
            <span className="font-semibold text-warn">
              <span aria-hidden="true">⚠ </span>No movement in{" "}
              {stagnant.map((v) => `D${v.id}`).join(", ")}.
            </span>{" "}
            You've drilled these recently without gaining. Switch modality — read the material, then
            retest.
          </p>
          <div className="flex flex-wrap gap-2 mt-2">
            {stagnant.map((v) => (
              <Link key={v.id} to={`/domains/${v.id}`} className="chip bg-panel2 text-xs hover:text-accent">
                Review D{v.id} →
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
