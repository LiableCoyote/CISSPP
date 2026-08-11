import { useState } from "react";
import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { parseISO } from "date-fns";
import { db, type Profile, type Quest, type QuizAttempt } from "../../db/schema";
import { buildDomainVelocity, detectStudySignals, type StudySignal } from "../../lib/analytics";
import { buildRecommendations } from "../../lib/recommendations";
import { breakdownMisses, buildRemediation } from "../../lib/remediation";
import { countDue } from "../../lib/questionSrs";
import { shouldNudge } from "../../lib/reminders";
import { getItem } from "../../lib/safeStorage";

const DISMISS_KEY = "cisspp-dismissed-signals";
const MAX_RECOMMENDATIONS = 2;

function loadDismissed(): string[] {
  try {
    return JSON.parse(sessionStorage.getItem(DISMISS_KEY) || "[]");
  } catch {
    return [];
  }
}

const SEVERITY_STYLES: Record<StudySignal["severity"], string> = {
  danger: "border-danger/40 bg-danger/5",
  warn: "border-warn/40 bg-warn/5",
  info: "border-accent/40 bg-accent/5",
};

export default function NextUp({
  profile,
  attempts,
  quests,
  currentWeek,
  currentDay,
}: {
  profile: Profile;
  attempts: QuizAttempt[];
  quests: Quest[];
  currentWeek: number;
  currentDay: number;
}) {
  // Dismissals live for the session only — a real problem should resurface later.
  const [dismissed, setDismissed] = useState<string[]>(loadDismissed);

  const flashcards = useLiveQuery(() => db.flashcards.toArray());
  const studyLog = useLiveQuery(() => db.studyLog.toArray());
  const answers = useLiveQuery(() => db.answers.toArray());
  const reviews = useLiveQuery(() => db.questionReviews.toArray());
  // Only the domain is needed per question, and the map is rebuilt on every
  // render otherwise; the question bank is already in the DB by this point.
  const questionDomains = useLiveQuery(async () => {
    const rows = await db.questions.toArray();
    return new Map(rows.map((q) => [q.id, q.domainId]));
  });

  // Only the top two recommendations render, and the list is priority-sorted, so
  // defaulting to [] made both visible links change identity once Dexie resolved
  // — a tap target that moves under the user's finger on mobile.
  if (!flashcards || !studyLog || !answers || !reviews || !questionDomains) return null;

  const now = new Date();
  const dueCards = flashcards.filter((c) => parseISO(c.dueAt) <= now).length;
  // "Overdue" means past due by a full day, not merely due.
  const overdueCards = flashcards.filter(
    (c) => (now.getTime() - parseISO(c.dueAt).getTime()) / 86_400_000 >= 1,
  ).length;

  const velocity = buildDomainVelocity(attempts);

  const signals = detectStudySignals({
    studyLog,
    attempts,
    lastActiveDate: profile.lastActiveDate,
    streak: profile.streak,
    overdueCards,
    // The half of the reminder feature that works on every platform. The
    // background notification is best-effort; this is not.
    nudgeDue: shouldNudge({
      enabled: getItem("cisspp-reminder-enabled") === "1",
      lastActiveDate: profile.lastActiveDate,
      preferredTime: getItem("cisspp-reminder-time") || "18:00",
      now,
    }),
  }).filter((s) => !dismissed.includes(s.id));

  const remediation = buildRemediation(
    breakdownMisses(answers, (id) => questionDomains.get(id)),
  );

  const recommendations = buildRecommendations({
    profile,
    attempts,
    quests,
    velocity,
    dueCards,
    overdueCards,
    currentWeek,
    currentDay,
    dueMisses: countDue(reviews, now),
    remediation,
  }).slice(0, MAX_RECOMMENDATIONS);

  const dismiss = (id: string) => {
    const next = [...dismissed, id];
    setDismissed(next);
    try {
      sessionStorage.setItem(DISMISS_KEY, JSON.stringify(next));
    } catch {
      // Private-mode storage failure shouldn't break the dashboard.
    }
  };

  return (
    <>
      {signals.map((s) => (
        <div key={s.id} className={`card mb-3 ${SEVERITY_STYLES[s.severity]}`} role="note">
          <div className="flex items-start gap-3">
            <span className="text-xl shrink-0 leading-none mt-0.5" aria-hidden="true">
              {s.icon}
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">{s.title}</p>
              <p className="text-xs text-dim mt-1">{s.body}</p>
              {s.to && s.actionLabel && (
                <Link
                  to={s.to}
                  className="inline-block text-xs text-accent hover:underline mt-2 font-medium"
                >
                  {s.actionLabel} <span aria-hidden="true">→</span>
                </Link>
              )}
            </div>
            <button
              onClick={() => dismiss(s.id)}
              className="text-dim hover:text-ink text-lg leading-none px-1 shrink-0"
              aria-label={`Dismiss: ${s.title}`}
            >
              ×
            </button>
          </div>
        </div>
      ))}

      <section aria-labelledby="next-up-heading" className="card mb-4">
        <h3 id="next-up-heading" className="font-semibold mb-3">
          <span aria-hidden="true">🧭 </span>Next Up
        </h3>
        <ul className="space-y-2" role="list">
          {recommendations.map((r) => (
            <li key={r.id}>
              <Link
                to={r.to}
                className="flex items-start gap-3 p-3 rounded-lg bg-panel2 hover:bg-border transition-colors"
              >
                <span className="text-xl shrink-0 leading-none mt-0.5" aria-hidden="true">
                  {r.icon}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium">{r.title}</span>
                  <span className="block text-xs text-dim mt-0.5">{r.body}</span>
                  <span className="block text-xs text-accent mt-1.5 font-medium">
                    {r.actionLabel} <span aria-hidden="true">→</span>
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
