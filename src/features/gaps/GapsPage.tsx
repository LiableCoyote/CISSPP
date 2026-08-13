import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { formatDistanceToNowStrict, parseISO } from "date-fns";
import { db } from "../../db/schema";
import { ALL_QUESTIONS } from "../../data/questions.seed";
import { DOMAINS } from "../../data/domains";
import { dueReviews, countDue } from "../../lib/questionSrs";
import EmptyState from "../../components/ui/EmptyState";

/**
 * The questions you've got wrong, and when they're coming back.
 *
 * Until this page existed the retry schedule was real but invisible: the only
 * way to meet a missed question was to start a retry quiz, which tells you
 * nothing about what is queued, what keeps catching you out, or when the
 * backlog clears. A spaced-repetition system the user cannot inspect asks for
 * trust it hasn't earned.
 */
export default function GapsPage() {
  const reviews = useLiveQuery(() => db.questionReviews.toArray());

  if (!reviews) return <div className="page text-dim">Loading…</div>;

  const now = new Date();
  const dueNow = countDue(reviews, now);
  const byId = new Map(ALL_QUESTIONS.map((q) => [q.id, q]));
  const domainName = (id: number) => DOMAINS.find((d) => d.id === id)?.name ?? `Domain ${id}`;

  // Hardest first, matching the order a retry session actually serves.
  const due = dueReviews(reviews, now);
  const scheduled = reviews
    .filter((r) => r.dueAt > now.toISOString())
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt));

  const row = (r: (typeof reviews)[number], upcoming: boolean) => {
    const q = byId.get(r.questionId);
    return (
      <li key={r.questionId} className="p-3 rounded-lg bg-panel2">
        <div className="flex items-start gap-2 mb-1 flex-wrap">
          <span className="chip">D{r.domainId}</span>
          <span className="pill bg-panel text-dim text-[10px]">
            missed {r.timesMissed}×
          </span>
          {upcoming ? (
            <span className="pill bg-panel text-dim text-[10px]">
              due in {formatDistanceToNowStrict(parseISO(r.dueAt))}
            </span>
          ) : (
            <span className="pill bg-xp/20 text-xp text-[10px]">due now</span>
          )}
        </div>
        {/* The prompt, not the answer. This is a worklist, not a cheat sheet —
            showing the answer here would defeat the retry it is scheduling. */}
        <p className="text-sm">{q ? q.prompt : "This question is no longer in the bank."}</p>
        <p className="text-xs text-dim mt-1">{domainName(r.domainId)}</p>
      </li>
    );
  };

  return (
    <div className="page">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h1 className="text-2xl font-bold">Your Gaps</h1>
        {dueNow > 0 && (
          <Link to="/quiz/session?mode=misses" className="btn-primary text-xs shrink-0">
            Retry {dueNow} now →
          </Link>
        )}
      </div>
      <p className="text-dim text-sm mb-6">
        Every question you've answered wrong, and when it comes back. Answer one
        correctly twice and it stops chasing you.
      </p>

      {reviews.length === 0 && (
        <EmptyState
          icon="🎯"
          title="No gaps yet"
          body="Questions you get wrong are added here automatically, with a spaced schedule for revisiting them. Take a quiz to get started."
          action={{ kind: "link", to: "/quiz", label: "Start a Quiz" }}
        />
      )}

      {due.length > 0 && (
        <section aria-labelledby="due-heading" className="mb-6">
          <h2 id="due-heading" className="text-lg font-semibold mb-3">
            Due now ({due.length})
          </h2>
          <ul className="space-y-2" role="list">
            {due.map((r) => row(r, false))}
          </ul>
        </section>
      )}

      {scheduled.length > 0 && (
        <section aria-labelledby="scheduled-heading">
          <h2 id="scheduled-heading" className="text-lg font-semibold mb-3">
            Scheduled ({scheduled.length})
          </h2>
          <p className="text-xs text-dim mb-3">
            Already answered correctly at least once. The interval grows each time
            you get one right again.
          </p>
          <ul className="space-y-2" role="list">
            {scheduled.map((r) => row(r, true))}
          </ul>
        </section>
      )}
    </div>
  );
}
