import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/schema";

/**
 * The four static data sets are loaded on first open, not imported.
 *
 * Layout mounts this component unconditionally, so a static import put the
 * question bank, vault tables, resource list and domain list into the entry
 * chunk — a couple of hundred KB on the landing route, for a feature behind
 * Cmd+K that many sessions never touch.
 */
type SearchIndex = {
  questions: { id: string; prompt: string; domainId: number }[];
  vaultTables: { id: string; title: string; intro: string; rows: string[][] }[];
  resources: { id: string; title: string; description: string }[];
  domains: { id: number; name: string; weight: number; priority: string }[];
};

async function loadSearchIndex(): Promise<SearchIndex> {
  const [{ ALL_QUESTIONS }, { VAULT_TABLES }, { RESOURCES }, { DOMAINS }] = await Promise.all([
    import("../data/questions.seed"),
    import("../data/vault"),
    import("../data/resources"),
    import("../data/domains"),
  ]);
  return {
    questions: ALL_QUESTIONS,
    vaultTables: VAULT_TABLES,
    resources: RESOURCES,
    domains: DOMAINS,
  };
}

type Hit = {
  id: string;
  label: string;
  context: string;
  category: "Quest" | "Flashcard" | "Question" | "Vault" | "Resource" | "Domain";
  route: string;
};

const MAX_PER_CATEGORY = 5;

function matches(text: string, q: string): boolean {
  return text.toLowerCase().includes(q);
}

export default function Search() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [rawActiveIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const quests = useLiveQuery(() => db.quests.toArray(), []);
  const flashcards = useLiveQuery(() => db.flashcards.toArray(), []);
  const notes = useLiveQuery(() => db.notes.toArray(), []);

  const [index, setIndex] = useState<SearchIndex | null>(null);
  // A ref, not state: two rapid opens must not fire two fetches, and the guard
  // has to be readable synchronously within the same tick.
  const indexRequested = useRef(false);

  // Resetting here rather than in an effect keyed on `open` keeps the state
  // change in the event that caused it.
  const openSearch = useCallback(() => {
    setQuery("");
    setActiveIdx(0);
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 30);

    // Kick off the fetch as the dialog opens. The user has to type two
    // characters before any of it is consulted, which is far longer than the
    // load takes — and on a failure the Dexie-backed categories still work.
    if (!indexRequested.current) {
      indexRequested.current = true;
      loadSearchIndex()
        .then(setIndex)
        .catch((err: unknown) => {
          console.error("Search index failed to load:", err);
          indexRequested.current = false;
        });
    }
  }, []);

  // Cmd/Ctrl+K to open
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (open) setOpen(false);
        else openSearch();
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, openSearch]);

  // Expose a global open handler for the header icon
  useEffect(() => {
    (window as Window & { __cisspp_openSearch?: () => void }).__cisspp_openSearch = openSearch;
    return () => {
      delete (window as Window & { __cisspp_openSearch?: () => void }).__cisspp_openSearch;
    };
  }, [openSearch]);

  const hits = useMemo<Hit[]>(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const out: Hit[] = [];

    (index?.domains ?? []).filter((d) => matches(d.name, q)).slice(0, MAX_PER_CATEGORY).forEach((d) =>
      out.push({
        id: `dom-${d.id}`,
        label: `D${d.id}: ${d.name}`,
        context: `${d.weight}% of exam · ${d.priority}`,
        category: "Domain",
        route: `/domains/${d.id}`,
      })
    );

    (quests || [])
      .filter((quest) => matches(quest.title, q) || matches(quest.description, q))
      .slice(0, MAX_PER_CATEGORY)
      .forEach((quest) =>
        out.push({
          id: `q-${quest.id}`,
          label: quest.title,
          context: `Week ${quest.week} · Day ${quest.day}`,
          category: "Quest",
          route: `/plan/week/${quest.week}`,
        })
      );

    (flashcards || [])
      .filter((c) => matches(c.front, q) || matches(c.back, q))
      .slice(0, MAX_PER_CATEGORY)
      .forEach((c) =>
        out.push({
          id: `fc-${c.id}`,
          label: c.front,
          context: c.back.slice(0, 80),
          category: "Flashcard",
          route: `/flashcards`,
        })
      );

    (index?.questions ?? []).filter((qq) => matches(qq.prompt, q))
      .slice(0, MAX_PER_CATEGORY)
      .forEach((qq) =>
        out.push({
          id: `qq-${qq.id}`,
          label: qq.prompt.slice(0, 90) + (qq.prompt.length > 90 ? "…" : ""),
          context: `Domain ${qq.domainId}`,
          category: "Question",
          route: `/domains/${qq.domainId}`,
        })
      );

    (index?.vaultTables ?? []).filter(
      (t) =>
        matches(t.title, q) ||
        matches(t.intro, q) ||
        t.rows.some((r) => r.some((cell) => matches(cell, q)))
    )
      .slice(0, MAX_PER_CATEGORY)
      .forEach((t) =>
        out.push({
          id: `v-${t.id}`,
          label: t.title,
          context: t.intro.slice(0, 80),
          category: "Vault",
          route: `/vault`,
        })
      );

    (index?.resources ?? []).filter((r) => matches(r.title, q) || matches(r.description, q))
      .slice(0, MAX_PER_CATEGORY)
      .forEach((r) =>
        out.push({
          id: `r-${r.id}`,
          label: r.title,
          context: r.description.slice(0, 80),
          category: "Resource",
          route: `/resources`,
        })
      );

    (notes || [])
      .filter((n) => matches(n.title, q) || matches(n.body, q))
      .slice(0, MAX_PER_CATEGORY)
      .forEach((n) =>
        out.push({
          id: `n-${n.id}`,
          label: n.title,
          context: n.body.slice(0, 80),
          category: "Domain",
          route: n.domainId ? `/domains/${n.domainId}` : "/domains",
        })
      );

    return out;
  }, [query, quests, flashcards, notes, index]);

  // Derived rather than stored: when the hit list shrinks under the cursor the
  // clamp applies on the same render, instead of after an extra effect pass
  // that briefly indexes past the end of the list.
  const activeIdx = rawActiveIdx >= hits.length ? 0 : rawActiveIdx;

  const go = (hit: Hit) => {
    setOpen(false);
    navigate(hit.route);
  };

  const onInputKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, hits.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const hit = hits[activeIdx];
      if (hit) go(hit);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 bg-bg/80 backdrop-blur-sm flex items-start justify-center p-4 pt-[10vh]"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-labelledby="search-label"
    >
      <div
        className="card max-w-xl w-full p-0 overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <span aria-hidden="true" className="text-dim">🔎</span>
          <label id="search-label" className="sr-only">
            Search across quests, flashcards, questions, vault, resources, and notes
          </label>
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKey}
            placeholder="Search quests, cards, questions, vault…"
            className="flex-1 bg-transparent outline-none text-base"
            aria-controls="search-results"
            aria-activedescendant={hits[activeIdx] ? `hit-${hits[activeIdx].id}` : undefined}
          />
          <kbd className="text-xs text-dim border border-border rounded px-1.5 py-0.5 hidden sm:inline">
            Esc
          </kbd>
        </div>

        <div
          id="search-results"
          role="listbox"
          className="max-h-[60vh] overflow-y-auto"
          aria-label="Search results"
        >
          {query.trim().length < 2 && (
            <div className="p-6 text-center text-sm text-dim">
              Type at least 2 characters. Navigate with ↑ / ↓, open with Enter.
            </div>
          )}
          {/* "No matches" would be a lie while the index is still in flight —
              questions, vault tables and resources genuinely cannot match yet. */}
          {query.trim().length >= 2 && hits.length === 0 && (
            <div className="p-6 text-center text-sm text-dim" aria-live="polite">
              {index ? "No matches." : "Loading search index…"}
            </div>
          )}
          {hits.map((h, i) => (
            <button
              key={h.id}
              id={`hit-${h.id}`}
              role="option"
              aria-selected={i === activeIdx}
              onClick={() => go(h)}
              onMouseEnter={() => setActiveIdx(i)}
              className={`w-full text-left px-4 py-3 flex items-start gap-3 border-b border-border last:border-0 ${
                i === activeIdx ? "bg-accent/10" : "hover:bg-panel2"
              }`}
            >
              <span className="pill bg-panel2 text-dim text-[10px] flex-shrink-0 mt-0.5">
                {h.category}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{h.label}</p>
                {h.context && (
                  <p className="text-xs text-dim truncate mt-0.5">{h.context}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
