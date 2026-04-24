import { useLiveQuery } from "dexie-react-hooks";
import { Link, useNavigate } from "react-router-dom";
import { db } from "../../db/schema";
import EmptyState from "../../components/ui/EmptyState";

export default function FlashcardsPage() {
  const cards = useLiveQuery(() => db.flashcards.toArray()) || [];
  const navigate = useNavigate();
  const now = new Date();
  const dueCards = cards.filter((c) => new Date(c.dueAt) <= now);
  const totalCards = cards.length;
  const learned = cards.filter((c) => c.reps >= 3).length;

  return (
    <div className="page">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Flashcards</h1>
        <Link to="/flashcards/new" className="btn-ghost text-sm">+ Add</Link>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="card p-3 text-center">
          <p className="text-xs text-dim">Due</p>
          <p className="text-2xl font-bold text-streak">{dueCards.length}</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-xs text-dim">Learned</p>
          <p className="text-2xl font-bold text-high">{learned}</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-xs text-dim">Total</p>
          <p className="text-2xl font-bold text-accent2">{totalCards}</p>
        </div>
      </div>

      {dueCards.length > 0 ? (
        <button
          onClick={() => navigate("/flashcards/review")}
          className="btn-primary w-full text-lg shadow-glow"
        >
          Review {dueCards.length} Due Cards →
        </button>
      ) : (
        <EmptyState
          icon="🎉"
          title="No cards due right now"
          body="Come back after your next study session, or add a card from a concept you just learned."
          action={{ kind: "link", to: "/flashcards/new", label: "Add a Card" }}
        />
      )}

      <h2 className="mt-8 mb-3 text-lg font-semibold">All cards ({cards.length})</h2>
      <div className="space-y-2">
        {cards.slice(0, 20).map((c) => (
          <div key={c.id} className="card p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{c.front}</p>
                <p className="text-sm text-dim mt-0.5 line-clamp-2">{c.back}</p>
              </div>
              {c.domainId && (
                <span className="chip shrink-0">D{c.domainId}</span>
              )}
            </div>
            {c.tags.length > 0 && (
              <div className="flex gap-1 mt-2 flex-wrap">
                {c.tags.map((t) => (
                  <span key={t} className="chip text-[10px]">#{t}</span>
                ))}
              </div>
            )}
          </div>
        ))}
        {cards.length > 20 && (
          <p className="text-center text-dim text-sm py-2">+ {cards.length - 20} more</p>
        )}
      </div>
    </div>
  );
}
