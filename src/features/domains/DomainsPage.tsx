import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/schema";
import { DOMAINS } from "../../data/domains";

export default function DomainsPage() {
  const attempts = useLiveQuery(() => db.attempts.toArray()) || [];

  return (
    <div className="page">
      <h1 className="text-2xl font-bold mb-2">Domains</h1>
      <p className="text-dim text-sm mb-6">
        HIGH priority = Domains 1, 3, 4, 5, 7 (68% of the exam). Weight your study accordingly.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {DOMAINS.map((d) => {
          const domainAttempts = attempts.filter((a) => a.domainId === d.id);
          const avgScore = domainAttempts.length > 0
            ? Math.round(domainAttempts.reduce((s, a) => s + a.scorePct, 0) / domainAttempts.length)
            : null;
          return (
            <Link
              key={d.id}
              to={`/domains/${d.id}`}
              className="card card-hover block"
              style={{ borderLeftWidth: 4, borderLeftColor: d.accent }}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm"
                    style={{ backgroundColor: d.accent + "22", color: d.accent }}
                  >
                    D{d.id}
                  </div>
                  <span className="text-xs text-dim font-semibold">{d.weight}%</span>
                </div>
                {d.priority === "HIGH" && (
                  <span className="pill bg-danger/15 text-danger text-[10px]">HIGH</span>
                )}
              </div>
              <h3 className="font-semibold text-sm leading-tight mb-2">{d.name}</h3>
              <div className="flex items-center justify-between text-xs text-dim">
                <span>
                  {domainAttempts.length > 0 ? `Avg ${avgScore}% · ${domainAttempts.length} attempts` : "No attempts yet"}
                </span>
                <span>→</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
