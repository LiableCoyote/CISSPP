import { useState, useEffect } from "react";
import { db } from "../db/schema";
import { format } from "date-fns";

type Phase = "idle" | "focus" | "break";

const FOCUS_SECONDS = 25 * 60;
const BREAK_SECONDS = 5 * 60;

export default function PomodoroFab() {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [seconds, setSeconds] = useState(FOCUS_SECONDS);

  useEffect(() => {
    if (phase === "idle") return;
    const timer = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          clearInterval(timer);
          finishPhase();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [phase]); // eslint-disable-line

  async function finishPhase() {
    if ("vibrate" in navigator) navigator.vibrate([30, 50, 30]);
    if (phase === "focus") {
      // Log 25 min to studyLog
      const today = format(new Date(), "yyyy-MM-dd");
      const existing = await db.studyLog.get(today);
      if (existing) {
        await db.studyLog.update(today, {
          minutes: existing.minutes + 25,
          sessions: existing.sessions + 1,
        });
      } else {
        await db.studyLog.add({
          date: today,
          minutes: 25,
          sessions: 1,
          questsCompleted: 0,
          flashcardsReviewed: 0,
        });
      }
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("Focus session complete", { body: "Take a 5-minute break.", icon: "/icons/icon-192.png" });
      }
      setPhase("break");
      setSeconds(BREAK_SECONDS);
    } else {
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("Break over", { body: "Ready for another Pomodoro?", icon: "/icons/icon-192.png" });
      }
      setPhase("idle");
      setSeconds(FOCUS_SECONDS);
    }
  }

  const start = () => {
    setPhase("focus");
    setSeconds(FOCUS_SECONDS);
  };
  const stop = () => {
    setPhase("idle");
    setSeconds(FOCUS_SECONDS);
  };

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`fixed bottom-20 md:bottom-6 right-4 w-14 h-14 rounded-full shadow-glow flex items-center justify-center z-30 transition-colors ${
          phase === "focus" ? "bg-danger text-ink animate-flicker" : phase === "break" ? "bg-accent text-bg" : "bg-panel border border-border text-ink hover:bg-panel2"
        }`}
        aria-label="Pomodoro timer"
      >
        {phase === "idle" ? "🍅" : phase === "focus" ? "🎯" : "☕"}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/60" onClick={() => setOpen(false)}>
          <div
            className="absolute bottom-0 inset-x-0 bg-panel border-t border-border rounded-t-2xl p-6 safe-bottom"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-1 bg-border rounded-full mx-auto mb-4" />
            <h3 className="text-center font-semibold mb-2">
              {phase === "idle" ? "Pomodoro Timer" : phase === "focus" ? "🎯 Focus" : "☕ Break"}
            </h3>
            <p className="text-6xl font-mono text-center mb-4 font-bold">
              {mm}:{ss}
            </p>
            {phase === "idle" ? (
              <button onClick={start} className="btn-primary w-full">Start 25-min Focus</button>
            ) : (
              <button onClick={stop} className="btn-danger w-full">Stop</button>
            )}
            <p className="text-xs text-dim text-center mt-3">
              Logs 25 min to your study heatmap on completion.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
