import { useState, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Link, useNavigate } from "react-router-dom";
import { db, type DomainId } from "../../db/schema";
import EmptyState from "../../components/ui/EmptyState";

const PAGE_SIZE = 25;

export default function FlashcardsPage() {
  const liveCards = useLiveQuery(() => db.flashcards.toArray());
  // Stable identity — a bare `|| []` allocates each render and defeats the memos below.
  const cards = useMemo(() => liveCards ?? [], [liveCards]);
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [domain, setDomain] = useState<DomainId | "all" | "none">("all");
  const [tag, setTag] = useState<string | null>(null);
  const [shown, setShown] = useState(PAGE_SIZE);

  const now = new Date();
  const dueCards = cards.filter((c) => new Date(c.dueAt) <= now);
  const learned = cards.filter((c) => c.reps >= 3).length;

  // Tags sorted by how many cards carry them.
  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of cards) for (const t of c.tags) counts.set(t, (counts.get(t) || 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [cards]);

  const domainsPresent = useMemo(
    () =>
      [...new Set(cards.map((c) => c.domainId).filter((d): d is DomainId => d !== null))].sort(
        (a, b) => a - b,
      ),
    [cards],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cards.filter((c) => {
      if (domain === "none" && c.domainId !== null) return false;
      if (domain !== "all" && domain !== "none" && c.domainId !== domain) return false;
      if (tag && !c.tags.includes(tag)) return false;
      if (q && !`${c.front} ${c.back}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [cards, query, domain, tag]);

  const resetPaging = () => setShown(PAGE_SIZE);
  const filtersActive = query.trim() !== "" || domain !== "all" || tag !== null;

  return (
    <div className="page">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Flashcards</h1>
        <Link to="/flashcards/new" className="btn-ghost text-sm">
          + Add
        </Link>
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
          <p className="text-2xl font-bold text-accent2">{cards.length}</p>
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

      <h2 className="mt-8 mb-3 text-lg font-semibold">Browse deck</h2>

      {/* Search */}
      <label className="sr-only" htmlFor="card-search">
        Search flashcards
      </label>
      <input
        id="card-search"
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          resetPaging();
        }}
        placeholder="Search front and back…"
        className="w-full bg-panel2 border border-border rounded-lg px-3 py-2 text-sm mb-3 focus-visible:ring-2 focus-visible:ring-accent outline-none"
      />

      {/* Domain filter */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2" role="group" aria-label="Filter by domain">
        {[
          { key: "all" as const, label: `All (${cards.length})` },
          ...domainsPresent.map((d) => ({
            key: d,
            label: `D${d} (${cards.filter((c) => c.domainId === d).length})`,
          })),
          { key: "none" as const, label: `Mindset (${cards.filter((c) => c.domainId === null).length})` },
        ].map((opt) => (
          <button
            key={String(opt.key)}
            onClick={() => {
              setDomain(opt.key);
              resetPaging();
            }}
            aria-pressed={domain === opt.key}
            className={`chip text-xs px-3 py-1.5 whitespace-nowrap shrink-0 border transition-colors ${
              domain === opt.key
                ? "bg-accent/15 text-accent border-accent/40"
                : "bg-panel2 text-dim border-transparent hover:text-ink"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Tag filter */}
      {tagCounts.length > 0 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 mb-3" role="group" aria-label="Filter by tag">
          {tagCounts.map(([t, n]) => (
            <button
              key={t}
              onClick={() => {
                setTag(tag === t ? null : t);
                resetPaging();
              }}
              aria-pressed={tag === t}
              className={`chip text-[11px] px-2.5 py-1 whitespace-nowrap shrink-0 border transition-colors ${
                tag === t
                  ? "bg-accent2/20 text-accent2 border-accent2/40"
                  : "bg-panel2 text-dim border-transparent hover:text-ink"
              }`}
            >
              #{t} {n}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-dim">
          {filtered.length} card{filtered.length === 1 ? "" : "s"}
          {filtersActive && ` of ${cards.length}`}
        </p>
        {filtersActive && (
          <button
            onClick={() => {
              setQuery("");
              setDomain("all");
              setTag(null);
              resetPaging();
            }}
            className="text-xs text-accent hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="card text-center py-6">
          <p className="text-2xl mb-2" aria-hidden="true">
            🔍
          </p>
          <p className="text-sm text-dim">No cards match those filters.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.slice(0, shown).map((c) => (
            <div key={c.id} className="card p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{c.front}</p>
                  <p className="text-sm text-dim mt-0.5">{c.back}</p>
                </div>
                <span className="chip shrink-0 text-[10px]">
                  {c.domainId ? `D${c.domainId}` : "Mindset"}
                </span>
              </div>
              {c.tags.length > 0 && (
                <div className="flex gap-1 mt-2 flex-wrap">
                  {c.tags.map((t) => (
                    <button
                      key={t}
                      onClick={() => {
                        setTag(t);
                        resetPaging();
                      }}
                      className="chip text-[10px] hover:text-accent"
                    >
                      #{t}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
          {filtered.length > shown && (
            <button
              onClick={() => setShown((s) => s + PAGE_SIZE)}
              className="btn-outline w-full text-sm"
            >
              Show {Math.min(PAGE_SIZE, filtered.length - shown)} more ·{" "}
              {filtered.length - shown} remaining
            </button>
          )}
        </div>
      )}
    </div>
  );
}
