import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type DomainId, type AppNote } from "../../db/schema";
import { DOMAINS } from "../../data/domains";
import { questionsByDomain } from "../../data/questions.seed";

export default function DomainDetailPage() {
  const { id } = useParams();
  const domainId = parseInt(id || "1", 10) as DomainId;
  const domain = DOMAINS.find((d) => d.id === domainId);
  const cards = useLiveQuery(() => db.flashcards.where("domainId").equals(domainId).toArray(), [domainId]);
  const attempts = useLiveQuery(() => db.attempts.where("domainId").equals(domainId).reverse().sortBy("startedAt"), [domainId]);
  const notes = useLiveQuery(() => db.notes.where("domainId").equals(domainId).toArray(), [domainId]);

  const [composing, setComposing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  if (!domain) return <div className="page">Domain not found.</div>;

  const questionCount = questionsByDomain(domainId).length;

  const startNew = () => {
    setEditingId(null);
    setTitle("");
    setBody("");
    setComposing(true);
  };

  const startEdit = (note: AppNote) => {
    setEditingId(note.id);
    setTitle(note.title);
    setBody(note.body);
    setComposing(true);
  };

  const cancel = () => {
    setComposing(false);
    setEditingId(null);
    setTitle("");
    setBody("");
  };

  const save = async () => {
    if (!title.trim() && !body.trim()) return;
    const now = new Date().toISOString();
    if (editingId) {
      await db.notes.update(editingId, { title: title.trim(), body: body.trim(), updatedAt: now });
    } else {
      await db.notes.add({
        id: `note-${Date.now()}`,
        domainId,
        title: title.trim() || "Untitled",
        body: body.trim(),
        updatedAt: now,
      });
    }
    cancel();
  };

  const remove = async (id: string) => {
    await db.notes.delete(id);
  };

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

      <section aria-labelledby="notes-heading" className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 id="notes-heading" className="text-lg font-semibold">Notes</h2>
          {!composing && (
            <button onClick={startNew} className="btn-outline text-sm px-3 py-1">
              + Add note
            </button>
          )}
        </div>

        {composing && (
          <div className="card mb-3">
            <label htmlFor="note-title" className="block text-xs text-dim mb-1">Title</label>
            <input
              id="note-title"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input mb-2"
              placeholder="e.g. Bell-LaPadula vs Biba"
              maxLength={120}
            />
            <label htmlFor="note-body" className="block text-xs text-dim mb-1">Body (markdown supported visually — renders as plain text)</label>
            <textarea
              id="note-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="input min-h-[120px]"
              placeholder="Key insight, mnemonic, or gotcha…"
              rows={5}
            />
            <div className="flex gap-2 mt-3">
              <button onClick={save} className="btn-primary flex-1" disabled={!title.trim() && !body.trim()}>
                {editingId ? "Save" : "Create note"}
              </button>
              <button onClick={cancel} className="btn-ghost">
                Cancel
              </button>
            </div>
          </div>
        )}

        {notes && notes.length > 0 ? (
          <div className="space-y-2">
            {notes
              .slice()
              .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
              .map((n) => (
                <article key={n.id} className="card">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="font-semibold">{n.title}</h3>
                    <div className="flex gap-1 flex-shrink-0">
                      <button
                        onClick={() => startEdit(n)}
                        className="text-xs text-dim hover:text-ink px-2 py-1"
                        aria-label={`Edit ${n.title}`}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => remove(n.id)}
                        className="text-xs text-danger hover:underline px-2 py-1"
                        aria-label={`Delete ${n.title}`}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  {n.body && (
                    <p className="text-sm text-dim whitespace-pre-wrap">{n.body}</p>
                  )}
                  <p className="text-[10px] text-dim mt-2">
                    Updated {new Date(n.updatedAt).toLocaleDateString()}
                  </p>
                </article>
              ))}
          </div>
        ) : (
          !composing && (
            <p className="text-sm text-dim">
              No notes yet. Add insights, mnemonics, or things that confused you — reviewing notes
              right before the exam is one of the highest-leverage moves.
            </p>
          )
        )}
      </section>

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
