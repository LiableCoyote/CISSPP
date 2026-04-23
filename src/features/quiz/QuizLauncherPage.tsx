import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { DOMAINS } from "../../data/domains";
import type { DomainId } from "../../db/schema";

export default function QuizLauncherPage() {
  const navigate = useNavigate();
  const [selectedDomain, setSelectedDomain] = useState<DomainId | null>(null);

  const start = (mode: "domain" | "mixed" | "full", domainId?: DomainId) => {
    const params = new URLSearchParams({ mode });
    if (domainId) params.set("domain", String(domainId));
    navigate(`/quiz/session?${params.toString()}`);
  };

  return (
    <div className="page">
      <h1 className="text-2xl font-bold mb-2">Start a Quiz</h1>
      <p className="text-dim text-sm mb-6">
        Pick your mode. Remember: BEST / FIRST / MOST. Think CISO, not technician.
      </p>

      {/* Domain drill */}
      <div className="card mb-4">
        <h3 className="font-semibold mb-1">Domain Drill</h3>
        <p className="text-sm text-dim mb-3">25 questions focused on a single domain.</p>
        <div className="grid grid-cols-2 gap-2">
          {DOMAINS.map((d) => (
            <button
              key={d.id}
              onClick={() => setSelectedDomain(d.id)}
              className={`p-3 rounded-lg border text-left transition-colors ${
                selectedDomain === d.id
                  ? "border-accent bg-accent/10"
                  : "border-border bg-panel2 hover:border-accent/50"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold" style={{ backgroundColor: d.accent + "33", color: d.accent }}>
                  D{d.id}
                </span>
                <span className="text-xs font-medium">{d.weight}%</span>
                {d.priority === "HIGH" && (
                  <span className="pill bg-danger/15 text-danger text-[9px]">HIGH</span>
                )}
              </div>
              <p className="text-sm font-medium line-clamp-2">{d.name}</p>
            </button>
          ))}
        </div>
        <button
          onClick={() => selectedDomain && start("domain", selectedDomain)}
          disabled={!selectedDomain}
          className="btn-primary w-full mt-3 disabled:opacity-50"
        >
          Start Domain Drill →
        </button>
      </div>

      {/* Mixed set */}
      <button
        onClick={() => start("mixed")}
        className="card card-hover w-full text-left block mb-4"
      >
        <div className="flex items-start gap-3">
          <span className="text-3xl" aria-hidden>🎲</span>
          <div>
            <h3 className="font-semibold">Mixed Set</h3>
            <p className="text-sm text-dim mt-1">50 questions across all 8 domains, timed.</p>
            <p className="text-xs text-accent mt-2">Tap to start →</p>
          </div>
        </div>
      </button>

      {/* Full exam */}
      <button
        onClick={() => start("full")}
        className="card card-hover w-full text-left block border-danger/40 bg-danger/5"
      >
        <div className="flex items-start gap-3">
          <span className="text-3xl" aria-hidden>🐉</span>
          <div>
            <h3 className="font-semibold">BOSS: Full Exam</h3>
            <p className="text-sm text-dim mt-1">
              150 questions · 3-hour hard timer · CAN'T GO BACK.
            </p>
            <p className="text-xs text-danger mt-2 font-semibold">
              Simulate the real thing →
            </p>
          </div>
        </div>
      </button>
    </div>
  );
}
