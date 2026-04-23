import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/schema";
import { RESOURCES } from "../../data/resources";
import { useProfile } from "../../state/profile";
import { differenceInCalendarDays, parseISO } from "date-fns";

export default function ResourcesPage() {
  const states = useLiveQuery(() => db.resources.toArray()) || [];
  const { profile } = useProfile();

  const daysSinceStart = profile ? differenceInCalendarDays(new Date(), parseISO(profile.startDate)) : 0;
  const currentWeek = Math.min(8, Math.max(1, Math.floor(daysSinceStart / 7) + 1));
  const crammerMode = currentWeek >= 7;

  const toggle = async (id: string) => {
    const existing = states.find((s) => s.id === id);
    const now = new Date().toISOString();
    if (existing) {
      await db.resources.update(id, { watched: !existing.watched, updatedAt: now });
    } else {
      await db.resources.add({ id, watched: true, updatedAt: now });
    }
  };

  const categories: { id: string; label: string }[] = [
    { id: "video", label: "📹 Videos" },
    { id: "reading", label: "📖 Reading" },
    { id: "official", label: "📜 Official" },
    { id: "community", label: "💬 Community" },
  ];

  return (
    <div className="page">
      <h1 className="text-2xl font-bold mb-2">Resources</h1>
      <p className="text-dim text-sm mb-4">
        The plan's free resource stack. Tap to mark as watched/read.
      </p>

      {crammerMode && (
        <div className="card mb-4 border-warn/40 bg-warn/5">
          <p className="text-sm">
            <span className="font-semibold text-warn">🚫 Crammer Prevention: </span>
            You're in Week {currentWeek}. Do NOT start new resources now. Stick with what you know and drill flashcards.
          </p>
        </div>
      )}

      {categories.map((cat) => {
        const items = RESOURCES.filter((r) => r.category === cat.id);
        if (items.length === 0) return null;
        return (
          <div key={cat.id} className="mb-6">
            <h2 className="font-semibold mb-2">{cat.label}</h2>
            <div className="space-y-2">
              {items.map((r) => {
                const state = states.find((s) => s.id === r.id);
                const watched = !!state?.watched;
                return (
                  <div key={r.id} className={`card ${watched ? "opacity-60" : ""}`}>
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => toggle(r.id)}
                        className={`w-6 h-6 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                          watched ? "bg-high border-high text-bg" : "border-border"
                        }`}
                        aria-label={watched ? "Mark unwatched" : "Mark watched"}
                      >
                        {watched && "✓"}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-sm">{r.title}</h3>
                          {r.isRequired && <span className="pill bg-accent/15 text-accent text-[10px]">required</span>}
                        </div>
                        <p className="text-sm text-dim mt-1">{r.description}</p>
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="link text-xs mt-2 inline-block"
                        >
                          Open →
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
