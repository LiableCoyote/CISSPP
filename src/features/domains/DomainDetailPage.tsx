import { useParams, Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type DomainId } from "../../db/schema";
import { DOMAINS } from "../../data/domains";
import { questionsByDomain } from "../../data/questions.seed";

export default function DomainDetailPage() {
  const { id } = useParams();
  const domainId = parseInt(id || "1", 10) as DomainId;
  const domain = DOMAINS.find((d) => d.id === domainId);
  const cards = useLiveQuery(() => db.flashcards.where("domainId").equals(domainId).toArray(), [domainId]);
  const attempts = useLiveQuery(() => db.attempts.where("domainId").equals(domainId).reverse().sortBy("startedAt"), [domainId]);

  if (!domain) return <div className="page">Domain not found.</div>;

  const questionCount = questionsByDomain(domainId).length;

  return (
    <div className="page">
      <div className="flex items-center gap-2 text-sm text-dim mb-2">
        <Link to="/domains" className="link">← Domains</Link>
        <span>/</span>
        <span>D{domain.id}</span>
      </div>

      <div className="flex items-start gap-3 mb-6">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center font-bold"
          style={{ backgroundColor: domain.accent + "22", color: domain.accent }}
        >
          D{domain.id}
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold leading-tight">{domain.name}</h1>
          <div className="flex gap-2 mt-1">
            <span className="chip">{domain.weight}% of exam</span>
            <span className={`pill text-[10px] ${domain.priority === "HIGH" ? "bg-danger/15 text-danger" : "bg-med/15 text-med"}`}>
              {domain.priority} PRIORITY
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-6">
        <div className="card p-3 text-center">
          <p className="text-xs text-dim">Flashcards</p>
          <p className="text-xl font-bold">{cards?.length || 0}</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-xs text-dim">Questions</p>
          <p className="text-xl font-bold">{questionCount}</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-xs text-dim">Attempts</p>
          <p className="text-xl font-bold">{attempts?.length || 0}</p>
        </div>
      </div>

      <Link to={`/quiz/session?mode=domain&domain=${domainId}`} className="btn-primary w-full mb-6">
        Start Domain Drill (25 Q) →
      </Link>

      <h2 className="text-lg font-semibold mb-3">Recent Attempts</h2>
      {attempts && attempts.length > 0 ? (
        <div className="space-y-2 mb-6">
          {attempts.slice(0, 5).map((a) => (
            <div key={a.id} className="card p-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{new Date(a.startedAt).toLocaleDateString()}</p>
                <p className="text-xs text-dim">
                  {a.score}/{a.questionIds.length} · {Math.round(a.totalSeconds / 60)} min
                </p>
              </div>
              <div className={`text-xl font-bold ${a.scorePct >= 75 ? "text-high" : a.scorePct >= 60 ? "text-warn" : "text-danger"}`}>
                {a.scorePct}%
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-dim mb-6">No attempts yet. Drill this domain to get started.</p>
      )}

      <h2 className="text-lg font-semibold mb-3">Flashcards for this domain</h2>
      {cards && cards.length > 0 ? (
        <div className="space-y-2">
          {cards.slice(0, 10).map((c) => (
            <div key={c.id} className="card p-3">
              <p className="font-medium text-sm">{c.front}</p>
              <p className="text-sm text-dim mt-1 line-clamp-2">{c.back}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-dim">No flashcards for this domain.</p>
      )}
    </div>
  );
}
